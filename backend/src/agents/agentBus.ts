/**
 * agentBus.ts — Event-Driven Agent Communication Bus
 *
 * The nervous system that lets agents trigger each other.
 * When one agent completes, it emits an event. The bus routes that event
 * to downstream agents, creating visible chain reactions.
 *
 * Architecture:
 *   User Action → Agent A completes → Bus emits event
 *                                         ↓
 *                              Downstream agents triggered
 *                                         ↓
 *                              Each emits its own event → more agents
 *                                         ↓
 *                              SSE broadcasts every event to frontend
 *
 * Cycle detection: max 3 hops per chain to prevent infinite loops.
 */

import { EventEmitter } from 'events';
import type { AgentName } from './orchestrator.js';

// ============================================================
// Types
// ============================================================

export type BusEventType =
    | 'vision:extracted'
    | 'watchdog:matched'
    | 'freedom:updated'
    | 'letter:generated'
    | 'call-script:generated'
    | 'debate:verdict'
    | 'coach:insight';

export interface BusEvent {
    id: string;
    type: BusEventType;
    source: AgentName;
    chainId: string;
    depth: number;          // How many hops deep in the chain (0 = user-initiated)
    timestamp: string;
    summary: string;        // Human-readable summary for the feed
    payload: unknown;       // Agent-specific output data
    durationMs?: number;
    triggeredBy?: string;   // ID of the event that triggered this one
}

export interface ChainSummary {
    chainId: string;
    events: BusEvent[];
    totalAgents: number;
    totalDurationMs: number;
    startedAt: string;
    completedAt?: string;
    status: 'running' | 'completed' | 'error';
}

// ============================================================
// Constants
// ============================================================

const MAX_CHAIN_DEPTH = 3;
const MAX_EVENT_LOG = 200;

// ============================================================
// Agent Event Bus (Singleton)
// ============================================================

class AgentBus extends EventEmitter {
    private eventLog: BusEvent[] = [];
    private chains: Map<string, ChainSummary> = new Map();
    private sseClients: Set<(event: BusEvent) => void> = new Set();

    constructor() {
        super();
        this.setMaxListeners(50);
    }

    /**
     * Emit an agent event onto the bus.
     * Returns false if chain depth exceeded (cycle prevention).
     */
    emit(type: BusEventType, event: Omit<BusEvent, 'id' | 'timestamp' | 'type'>): boolean {
        // Cycle detection
        if (event.depth > MAX_CHAIN_DEPTH) {
            console.log(`[AgentBus] Chain depth ${event.depth} exceeds max ${MAX_CHAIN_DEPTH}, stopping chain ${event.chainId}`);
            return false;
        }

        const fullEvent: BusEvent = {
            ...event,
            id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type,
            timestamp: new Date().toISOString(),
        };

        // Log the event
        this.eventLog.push(fullEvent);
        if (this.eventLog.length > MAX_EVENT_LOG) this.eventLog.shift();

        // Track chain
        this.trackChain(fullEvent);

        // Broadcast to SSE clients
        for (const client of this.sseClients) {
            try { client(fullEvent); } catch { /* client disconnected */ }
        }

        console.log(`[AgentBus] ${fullEvent.source} → ${type} (chain: ${fullEvent.chainId}, depth: ${fullEvent.depth})`);

        // Fire EventEmitter listeners (this triggers downstream agent handlers)
        return super.emit(type, fullEvent);
    }

    private trackChain(event: BusEvent) {
        let chain = this.chains.get(event.chainId);
        if (!chain) {
            chain = {
                chainId: event.chainId,
                events: [],
                totalAgents: 0,
                totalDurationMs: 0,
                startedAt: event.timestamp,
                status: 'running',
            };
            this.chains.set(event.chainId, chain);
        }
        chain.events.push(event);
        chain.totalAgents = new Set(chain.events.map(e => e.source)).size;
        chain.totalDurationMs += event.durationMs || 0;
    }

    /**
     * Mark a chain as completed. Called after all downstream handlers finish.
     */
    completeChain(chainId: string) {
        const chain = this.chains.get(chainId);
        if (chain) {
            chain.status = 'completed';
            chain.completedAt = new Date().toISOString();

            // Broadcast chain-complete event to SSE clients
            const summary: BusEvent = {
                id: `evt_chain_${Date.now()}`,
                type: 'freedom:updated' as BusEventType,  // reuse type
                source: 'freedom' as AgentName,
                chainId,
                depth: -1,  // sentinel: chain summary
                timestamp: new Date().toISOString(),
                summary: `Chain complete: ${chain.totalAgents} agents, ${(chain.totalDurationMs / 1000).toFixed(1)}s`,
                payload: {
                    _chainSummary: true,
                    totalAgents: chain.totalAgents,
                    totalDurationMs: chain.totalDurationMs,
                    agentsFired: chain.events.map(e => e.source),
                },
            };
            for (const client of this.sseClients) {
                try { client(summary); } catch { /* skip */ }
            }
        }
    }

    /**
     * Generate a new chain ID for a user-initiated action.
     */
    newChainId(): string {
        return `chain_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    }

    /**
     * Register an SSE client to receive all bus events.
     * Returns an unsubscribe function.
     */
    subscribe(callback: (event: BusEvent) => void): () => void {
        this.sseClients.add(callback);
        return () => { this.sseClients.delete(callback); };
    }

    /**
     * Get recent events (for initial SSE load).
     */
    getRecentEvents(limit = 50): BusEvent[] {
        return this.eventLog.slice(-limit);
    }

    /**
     * Get chain summary by ID.
     */
    getChain(chainId: string): ChainSummary | undefined {
        return this.chains.get(chainId);
    }

    /**
     * Get all active/recent chains.
     */
    getChains(limit = 10): ChainSummary[] {
        return Array.from(this.chains.values()).slice(-limit);
    }
}

// Singleton instance
export const agentBus = new AgentBus();
export default agentBus;
