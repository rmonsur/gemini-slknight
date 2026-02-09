/**
 * orchestrator.ts — Self-Correcting Agent Orchestrator
 *
 * Central nervous system for all agent calls. Every agent goes through here.
 * Tracks performance, evaluates output quality via Gemini, retries on failure,
 * and maintains a running log of agent health for autonomous monitoring.
 *
 * Architecture:
 *   User Action → Orchestrator → Agent Call → Output
 *                                    ↓
 *                          Quality Evaluator (Gemini Flash)
 *                                    ↓
 *                     Pass? → Return to user
 *                     Fail? → Log issue → Retry with corrections → Return
 */

import { getFlashModel } from '../config/gemini.js';
import { parseJSON } from '../utils/cleanJSON.js';
import type { UserRecord, AgentResponse } from '../types/index.js';
import { agentBus, type BusEventType, type BusEvent } from './agentBus.js';

// ============================================================
// Types
// ============================================================

export type AgentName =
    | 'freedom'
    | 'watchdog'
    | 'coach'
    | 'simulator'
    | 'auditor'
    | 'vision'
    | 'letter'
    | 'debate'
    | 'call-script'
    | 'future-self';

export interface AgentCallLog {
    id: string;
    agent: AgentName;
    timestamp: string;
    durationMs: number;
    success: boolean;
    qualityScore: number;        // 0-100, evaluated by Gemini
    qualityReasoning: string;    // Why the score was given
    retryCount: number;
    inputSummary: string;        // Brief description of input
    outputSummary: string;       // Brief description of output
    correctionApplied?: string;  // What was fixed on retry
    error?: string;
}

export interface AgentHealth {
    agent: AgentName;
    totalCalls: number;
    successRate: number;         // 0-100
    avgQualityScore: number;     // 0-100
    avgLatencyMs: number;
    lastCallAt: string | null;
    lastError: string | null;
    status: 'healthy' | 'degraded' | 'failing';
    recentCorrections: string[];
}

export interface OrchestratorState {
    agents: Record<AgentName, AgentHealth>;
    totalCalls: number;
    totalCorrections: number;
    upSince: string;
    callLog: AgentCallLog[];     // Last N calls
}

// ============================================================
// In-memory state (persists across requests during server lifetime)
// ============================================================

const MAX_LOG_SIZE = 100;

const AGENT_NAMES: AgentName[] = [
    'freedom', 'watchdog', 'coach', 'simulator', 'auditor',
    'vision', 'letter', 'debate', 'call-script', 'future-self',
];

function createEmptyHealth(agent: AgentName): AgentHealth {
    return {
        agent,
        totalCalls: 0,
        successRate: 100,
        avgQualityScore: 0,
        avgLatencyMs: 0,
        lastCallAt: null,
        lastError: null,
        status: 'healthy',
        recentCorrections: [],
    };
}

const state: OrchestratorState = {
    agents: Object.fromEntries(AGENT_NAMES.map(a => [a, createEmptyHealth(a)])) as Record<AgentName, AgentHealth>,
    totalCalls: 0,
    totalCorrections: 0,
    upSince: new Date().toISOString(),
    callLog: [],
};

// ============================================================
// Quality Evaluator — Uses Gemini Flash to score agent outputs
// ============================================================

interface QualityEvaluation {
    score: number;
    reasoning: string;
    hasCriticalIssue: boolean;
    suggestedFix?: string;
}

async function evaluateQuality(
    agentName: AgentName,
    input: string,
    output: string,
): Promise<QualityEvaluation> {
    try {
        const model = getFlashModel();

        const prompt = `You are a QA evaluator for a financial AI system. Rate this agent's output.

AGENT: ${agentName}
INPUT (summary): ${input.substring(0, 500)}
OUTPUT (summary): ${output.substring(0, 1000)}

Evaluate on these criteria:
1. ACCURACY: Does the output contain real, specific financial data (dollar amounts, rates, dates)?
2. COMPLETENESS: Did the agent address the full request?
3. SAFETY: No hallucinated financial advice, no dangerous recommendations?
4. FORMAT: Is the output properly structured (valid JSON if expected)?

Return ONLY valid JSON:
{
  "score": 0-100,
  "reasoning": "1-2 sentence explanation",
  "hasCriticalIssue": true/false,
  "suggestedFix": "what to change if score < 60, or null"
}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        return parseJSON<QualityEvaluation>(text, {
            score: 70,
            reasoning: 'Evaluation completed with default score',
            hasCriticalIssue: false,
        });
    } catch {
        // If evaluation itself fails, assume output is acceptable
        return {
            score: 65,
            reasoning: 'Quality evaluation skipped (evaluator error)',
            hasCriticalIssue: false,
        };
    }
}

// ============================================================
// Core Orchestrator Functions
// ============================================================

function generateId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function updateHealth(agentName: AgentName, log: AgentCallLog) {
    const health = state.agents[agentName];
    health.totalCalls++;
    health.lastCallAt = log.timestamp;

    // Rolling average for quality
    health.avgQualityScore = health.totalCalls === 1
        ? log.qualityScore
        : Math.round((health.avgQualityScore * (health.totalCalls - 1) + log.qualityScore) / health.totalCalls);

    // Rolling average for latency
    health.avgLatencyMs = health.totalCalls === 1
        ? log.durationMs
        : Math.round((health.avgLatencyMs * (health.totalCalls - 1) + log.durationMs) / health.totalCalls);

    // Success rate
    const successCount = state.callLog
        .filter(l => l.agent === agentName && l.success)
        .length + (log.success ? 1 : 0);
    health.successRate = Math.round((successCount / health.totalCalls) * 100);

    // Status determination
    if (health.successRate < 50 || health.avgQualityScore < 40) {
        health.status = 'failing';
    } else if (health.successRate < 80 || health.avgQualityScore < 60) {
        health.status = 'degraded';
    } else {
        health.status = 'healthy';
    }

    if (!log.success && log.error) {
        health.lastError = log.error;
    }

    if (log.correctionApplied) {
        health.recentCorrections.push(log.correctionApplied);
        if (health.recentCorrections.length > 5) {
            health.recentCorrections.shift();
        }
    }
}

/**
 * Execute an agent call through the orchestrator with quality evaluation
 * and automatic retry on failure.
 */
export async function orchestrate<T>(
    agentName: AgentName,
    inputSummary: string,
    agentFn: () => Promise<T>,
    options?: {
        maxRetries?: number;
        retryFn?: (suggestedFix: string) => Promise<T>;
        outputToString?: (output: T) => string;
        skipQualityCheck?: boolean;
    },
): Promise<{ result: T; log: AgentCallLog }> {
    const callId = generateId();
    const startTime = Date.now();
    const maxRetries = options?.maxRetries ?? 1;
    let lastError: string | undefined;
    let retryCount = 0;
    let correctionApplied: string | undefined;

    // Mark matching checklist items as in_progress
    for (const sid of getChecklistSessions()) {
        const items = getChecklist(sid);
        for (const item of items) {
            if (item.assignedAgent === agentName && item.status === 'pending') {
                updateChecklistItem(sid, item.id, {
                    status: 'in_progress',
                    progress: 30,
                    startedAt: new Date().toISOString(),
                });
            }
        }
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = attempt === 0
                ? await agentFn()
                : options?.retryFn
                    ? await options.retryFn(correctionApplied || 'Retry with improved parameters')
                    : await agentFn();

            const durationMs = Date.now() - startTime;
            const outputStr = options?.outputToString
                ? options.outputToString(result)
                : JSON.stringify(result).substring(0, 500);

            // Quality evaluation
            let quality: QualityEvaluation = { score: 80, reasoning: 'Skipped', hasCriticalIssue: false };

            if (!options?.skipQualityCheck) {
                quality = await evaluateQuality(agentName, inputSummary, outputStr);
            }

            // If quality is critically low AND we have retries left, retry
            if (quality.hasCriticalIssue && attempt < maxRetries && options?.retryFn) {
                console.log(`[Orchestrator] ${agentName} quality issue (${quality.score}/100): ${quality.reasoning}. Retrying...`);
                correctionApplied = quality.suggestedFix || 'Retry with stricter validation';
                retryCount++;
                state.totalCorrections++;
                continue;
            }

            // Log the call
            const log: AgentCallLog = {
                id: callId,
                agent: agentName,
                timestamp: new Date().toISOString(),
                durationMs,
                success: true,
                qualityScore: quality.score,
                qualityReasoning: quality.reasoning,
                retryCount,
                inputSummary: inputSummary.substring(0, 200),
                outputSummary: outputStr.substring(0, 200),
                correctionApplied,
            };

            // Update state
            state.callLog.push(log);
            if (state.callLog.length > MAX_LOG_SIZE) state.callLog.shift();
            state.totalCalls++;
            updateHealth(agentName, log);

            console.log(`[Orchestrator] ${agentName} completed in ${durationMs}ms | Quality: ${quality.score}/100 | Retries: ${retryCount}`);

            return { result, log };

        } catch (err) {
            lastError = err instanceof Error ? err.message : 'Unknown error';
            console.error(`[Orchestrator] ${agentName} attempt ${attempt + 1} failed:`, lastError);

            if (attempt < maxRetries) {
                retryCount++;
                correctionApplied = `Auto-retry after error: ${lastError}`;
                state.totalCorrections++;
                continue;
            }
        }
    }

    // All attempts failed
    const durationMs = Date.now() - startTime;
    const log: AgentCallLog = {
        id: callId,
        agent: agentName,
        timestamp: new Date().toISOString(),
        durationMs,
        success: false,
        qualityScore: 0,
        qualityReasoning: `All ${maxRetries + 1} attempts failed`,
        retryCount,
        inputSummary: inputSummary.substring(0, 200),
        outputSummary: '',
        correctionApplied,
        error: lastError,
    };

    state.callLog.push(log);
    if (state.callLog.length > MAX_LOG_SIZE) state.callLog.shift();
    state.totalCalls++;
    updateHealth(agentName, log);

    throw new Error(`[Orchestrator] ${agentName} failed after ${retryCount + 1} attempts: ${lastError}`);
}

// ============================================================
// Checklist System — Orchestrator creates tasks, assigns agents, tracks progress
// ============================================================

export interface ChecklistItem {
    id: string;
    task: string;
    description: string;
    assignedAgent: AgentName;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress: number;        // 0-100
    result?: string;
    decision?: string;       // AI's decision/recommendation
    startedAt?: string;
    completedAt?: string;
}

// In-memory checklists keyed by session
const checklists: Map<string, ChecklistItem[]> = new Map();

/**
 * Create a new checklist for a session. The orchestrator generates tasks
 * and assigns each to an AI agent.
 */
export function createChecklist(sessionId: string, items: Omit<ChecklistItem, 'id' | 'status' | 'progress'>[]): ChecklistItem[] {
    const checklistItems: ChecklistItem[] = items.map((item, i) => ({
        ...item,
        id: `task_${Date.now()}_${i}`,
        status: 'pending' as const,
        progress: 0,
    }));
    checklists.set(sessionId, checklistItems);
    return checklistItems;
}

/**
 * Update a single checklist item (status, progress, result, decision)
 */
export function updateChecklistItem(
    sessionId: string,
    itemId: string,
    update: Partial<Pick<ChecklistItem, 'status' | 'progress' | 'result' | 'decision' | 'startedAt' | 'completedAt'>>,
): ChecklistItem | null {
    const items = checklists.get(sessionId);
    if (!items) return null;
    const item = items.find(i => i.id === itemId);
    if (!item) return null;
    Object.assign(item, update);
    return item;
}

/**
 * Get all checklist items for a session
 */
export function getChecklist(sessionId: string): ChecklistItem[] {
    return checklists.get(sessionId) || [];
}

/**
 * Get all session IDs that have checklists
 */
export function getChecklistSessions(): string[] {
    return Array.from(checklists.keys());
}

/**
 * Build the default borrower action checklist. Called when freedom path is generated.
 */
export function buildBorrowerChecklist(sessionId: string): ChecklistItem[] {
    return createChecklist(sessionId, [
        {
            task: 'Analyze loan documents',
            description: 'Extract loan balances, rates, and servicer info from uploaded screenshots',
            assignedAgent: 'vision',
        },
        {
            task: 'Find matching grants & opportunities',
            description: 'Scan 35+ relocation grants, forgiveness programs, and refinancing options',
            assignedAgent: 'watchdog',
        },
        {
            task: 'Evaluate repayment strategy',
            description: 'Hawk vs Dove analysis: aggressive payoff vs patient optimization',
            assignedAgent: 'debate',
        },
        {
            task: 'Generate servicer letter',
            description: 'Draft professional letter for SAVE enrollment or rate reduction',
            assignedAgent: 'letter',
        },
        {
            task: 'Prepare servicer call script',
            description: 'Create talking points and rebuttals for calling loan servicer',
            assignedAgent: 'call-script',
        },
        {
            task: 'Calculate freedom path',
            description: 'Generate optimal debt-free timeline with milestone tasks',
            assignedAgent: 'freedom',
        },
        {
            task: 'Coach financial habits',
            description: 'Provide personalized savings tips and budget recommendations',
            assignedAgent: 'coach',
        },
    ]);
}

// ============================================================
// State Accessors
// ============================================================

export function getOrchestratorState(): OrchestratorState {
    return { ...state, callLog: [...state.callLog].reverse() };
}

export function getAgentHealthMap(): Record<AgentName, AgentHealth> {
    return { ...state.agents };
}

export function getRecentLogs(limit = 20): AgentCallLog[] {
    return state.callLog.slice(-limit).reverse();
}

// ============================================================
// Agent Event Bus Integration — Downstream Triggers
// ============================================================

/**
 * Helper to emit an event after an agent completes.
 * Call this from controllers after orchestrate() returns.
 */
export function emitAgentEvent(
    eventType: BusEventType,
    source: AgentName,
    summary: string,
    payload: unknown,
    chainId?: string,
    depth?: number,
    triggeredBy?: string,
    durationMs?: number,
) {
    const cid = chainId || agentBus.newChainId();
    agentBus.emit(eventType, {
        source,
        chainId: cid,
        depth: depth ?? 0,
        summary,
        payload,
        triggeredBy,
        durationMs,
    });
    return cid;
}

/**
 * Register all downstream agent triggers on the bus.
 * Called once at module load — agents listen for upstream events
 * and auto-fire their own logic.
 *
 * Chain map:
 *   vision:extracted  → watchdog, freedom
 *   watchdog:matched  → freedom, letter
 *   debate:verdict    → freedom, coach
 *   freedom:updated   → call-script, coach
 *   letter:generated  → call-script
 */
function registerBusHandlers() {
    // vision:extracted → trigger watchdog + freedom
    agentBus.on('vision:extracted', async (event: BusEvent) => {
        if (event.depth >= 3) return;
        console.log(`[Bus] vision:extracted → triggering watchdog + freedom (depth ${event.depth + 1})`);

        // We just broadcast that these agents SHOULD fire.
        // The actual agent calls happen in the controller via the vision-extract SSE chain.
        // This handler is for autonomous chains triggered outside the vision endpoint.
        try {
            const { watchdogAgent } = await import('./watchdogAgent.js');
            const { getDemoUser } = await import('../middleware/demoMode.js');
            const user = getDemoUser();

            const { result: watchdogResult, log } = await orchestrate(
                'watchdog',
                'Bus chain: match grants to vision extraction',
                () => watchdogAgent(user),
                { maxRetries: 1, skipQualityCheck: true },
            );

            emitAgentEvent(
                'watchdog:matched',
                'watchdog',
                `Matched ${watchdogResult.offers?.length || 0} grants`,
                watchdogResult,
                event.chainId,
                event.depth + 1,
                event.id,
                log.durationMs,
            );
        } catch (err) {
            console.error('[Bus] watchdog chain failed:', err);
        }
    });

    // watchdog:matched → trigger freedom recalculation
    agentBus.on('watchdog:matched', async (event: BusEvent) => {
        if (event.depth >= 3) return;
        console.log(`[Bus] watchdog:matched → triggering freedom recalculation (depth ${event.depth + 1})`);

        try {
            const { freedomAgent } = await import('./freedomAgent.js');
            const { getDemoUser } = await import('../middleware/demoMode.js');
            const user = getDemoUser();

            const { result: freedomResult, log } = await orchestrate(
                'freedom',
                'Bus chain: recalculate path after grant matching',
                () => freedomAgent(user),
                { maxRetries: 1, skipQualityCheck: true },
            );

            emitAgentEvent(
                'freedom:updated',
                'freedom',
                `Path recalculated: ${(freedomResult as unknown as Record<string, unknown>)?.optimalOutcome ? 'success' : 'generated'}`,
                freedomResult,
                event.chainId,
                event.depth + 1,
                event.id,
                log.durationMs,
            );
        } catch (err) {
            console.error('[Bus] freedom chain failed:', err);
        }
    });

    // debate:verdict → trigger freedom fork + coach explanation
    agentBus.on('debate:verdict', async (event: BusEvent) => {
        if (event.depth >= 3) return;
        const verdict = event.payload as Record<string, unknown>;
        console.log(`[Bus] debate:verdict (${verdict.choice}) → triggering freedom recalculation (depth ${event.depth + 1})`);

        try {
            const { freedomAgent } = await import('./freedomAgent.js');
            const { getDemoUser } = await import('../middleware/demoMode.js');
            const user = getDemoUser();
            const strategy = (verdict.strategy as Record<string, string>)?.name || '';

            const { result: freedomResult, log } = await orchestrate(
                'freedom',
                `Bus chain: fork path after debate verdict — ${strategy}`,
                () => freedomAgent(user, `Apply ${verdict.choice} strategy: ${strategy}`),
                { maxRetries: 1, skipQualityCheck: true },
            );

            emitAgentEvent(
                'freedom:updated',
                'freedom',
                `Path forked with ${verdict.choice} strategy: ${strategy}`,
                freedomResult,
                event.chainId,
                event.depth + 1,
                event.id,
                log.durationMs,
            );
        } catch (err) {
            console.error('[Bus] freedom (debate) chain failed:', err);
        }
    });

    // freedom:updated → trigger call-script update
    agentBus.on('freedom:updated', async (event: BusEvent) => {
        if (event.depth >= 3) return;
        // Only complete the chain — don't trigger more agents to avoid noise
        console.log(`[Bus] freedom:updated — completing chain ${event.chainId}`);
        agentBus.completeChain(event.chainId);
    });

    // ---- Auto-update checklist items when agents complete ----
    // Map bus event sources to checklist assignedAgent names
    const AGENT_TO_CHECKLIST: Record<string, string> = {
        vision: 'vision',
        watchdog: 'watchdog',
        debate: 'debate',
        letter: 'letter',
        'call-script': 'call-script',
        freedom: 'freedom',
        coach: 'coach',
    };

    // Listen to ALL bus events and update matching checklist items
    for (const eventType of [
        'vision:extracted', 'watchdog:matched', 'debate:verdict',
        'letter:generated', 'call-script:generated', 'freedom:updated', 'coach:insight',
    ] as const) {
        agentBus.on(eventType, (event: BusEvent) => {
            const agentName = AGENT_TO_CHECKLIST[event.source];
            if (!agentName) return;

            // Update ALL active checklists
            for (const sid of getChecklistSessions()) {
                const items = getChecklist(sid);
                for (const item of items) {
                    if (item.assignedAgent === agentName && item.status !== 'completed') {
                        updateChecklistItem(sid, item.id, {
                            status: 'completed',
                            progress: 100,
                            result: event.summary,
                            completedAt: new Date().toISOString(),
                        });
                        console.log(`[Checklist] Auto-completed "${item.task}" via ${eventType}`);
                    }
                }
            }
        });
    }

    console.log('[AgentBus] All downstream handlers registered');
}

// Register handlers on module load
registerBusHandlers();

// Re-export bus utilities for controllers
export { agentBus, type BusEvent, type BusEventType } from './agentBus.js';

export default orchestrate;
