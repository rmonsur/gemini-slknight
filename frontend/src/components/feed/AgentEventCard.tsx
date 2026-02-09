// @ts-nocheck
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export interface AgentEvent {
    id: string;
    type: string;
    source: string;
    chainId: string;
    depth: number;
    timestamp: string;
    summary: string;
    payload: unknown;
    durationMs?: number;
    triggeredBy?: string;
}

const AGENT_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
    vision: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: '👁', label: 'Vision' },
    watchdog: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: '🔍', label: 'Watchdog' },
    freedom: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '🗽', label: 'Freedom' },
    letter: { color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', icon: '✉️', label: 'Letter' },
    'call-script': { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: '📞', label: 'Call Script' },
    debate: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: '⚔️', label: 'Debate' },
    coach: { color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', icon: '🔥', label: 'Coach' },
    simulator: { color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: '🎮', label: 'Simulator' },
};

const DEFAULT_CONFIG = { color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', icon: '🤖', label: 'Agent' };

/**
 * Generate a human-readable paragraph from an agent event payload.
 */
function describePayload(source: string, type: string, payload: unknown): string {
    const p = payload as Record<string, unknown>;
    if (!p || typeof p !== 'object') return '';

    switch (source) {
        case 'vision': {
            const ext = (p.extractedData || p) as Record<string, unknown>;
            const fields = Object.entries(ext).filter(([, v]) => v !== null && v !== undefined);
            const servicer = ext.servicerName || 'your servicer';
            const balance = ext.principalBalance;
            const rate = ext.interestRate;
            const conf = p.confidence;
            let text = `Gemini Vision successfully read your loan document from ${servicer} and extracted ${fields.length} data points.`;
            if (balance) text += ` Your current balance is $${Number(balance).toLocaleString()}.`;
            if (rate) text += ` Your interest rate is ${(Number(rate) * 100).toFixed(1)}%.`;
            if (conf) text += ` Confidence: ${Math.round(Number(conf) * 100)}%.`;
            return text;
        }
        case 'watchdog': {
            const count = p.count || (p.offers as unknown[])?.length || 0;
            const total = p.totalValue || 0;
            let text = `The Watchdog agent scanned 35+ relocation grants, forgiveness programs, and refinancing offers against your profile.`;
            if (count) text += ` It found ${count} matching opportunities worth a combined $${Number(total).toLocaleString()}.`;
            text += ` These include state-specific grants and federal programs you may qualify for.`;
            return text;
        }
        case 'freedom': {
            const outcome = (p.optimalOutcome || p) as Record<string, unknown>;
            const date = outcome.debtFreeDate;
            const strategy = outcome.strategyName;
            const saved = outcome.totalSaved;
            let text = `The Freedom agent recalculated your optimal path to becoming debt-free.`;
            if (date) text += ` Your projected debt-free date is ${date}.`;
            if (strategy) text += ` Recommended strategy: ${strategy}.`;
            if (saved) text += ` This approach could save you $${Number(saved).toLocaleString()} in total interest.`;
            return text;
        }
        case 'debate': {
            const winner = p.winnerName || p.choice;
            const conf = p.confidence;
            const ruling = p.ruling;
            const strat = (p.strategy as Record<string, unknown>)?.name;
            if (ruling) return String(ruling);
            let text = `The debate concluded with ${winner} winning`;
            if (conf) text += ` at ${Math.round(Number(conf) * 100)}% confidence`;
            text += `.`;
            if (strat) text += ` Recommended strategy: ${strat}.`;
            return text;
        }
        case 'letter': {
            const lt = p.letterType || 'servicer communication';
            const svc = p.servicer || 'your loan servicer';
            return `The Letter agent auto-generated a ${lt} letter addressed to ${svc}. The letter is ready to review, copy, and send — no editing required.`;
        }
        case 'call-script': {
            const svc = p.servicer || 'your servicer';
            const obj = p.objective || 'your inquiry';
            return `The Call Script agent prepared a structured talking guide for calling ${svc} about ${obj}. It includes an opening statement, key talking points with anticipated responses, and rebuttals for common objections.`;
        }
        case 'coach': {
            const msg = p.message || p.advice;
            if (msg) return String(msg).substring(0, 300);
            return `The Coach agent analyzed your financial situation and provided personalized guidance on optimizing your repayment strategy.`;
        }
        default:
            return `Agent completed its task and produced results. Tap to see full details.`;
    }
}

interface AgentEventCardProps {
    event: AgentEvent;
    isLatest?: boolean;
    showConnector?: boolean;
}

export function AgentEventCard({ event, isLatest = false, showConnector = true }: AgentEventCardProps) {
    const [expanded, setExpanded] = useState(false);
    const config = AGENT_CONFIG[event.source] || DEFAULT_CONFIG;

    // Chain summary sentinel
    const isChainSummary = event.depth === -1 && (event.payload as Record<string, unknown>)?._chainSummary;

    if (isChainSummary) {
        const p = event.payload as Record<string, unknown>;
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mx-3 mb-3 px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-center"
            >
                <p className="text-gray-500 font-medium" style={{ fontSize: '16px' }}>
                    Chain complete &middot; {p.totalAgents as number} agents &middot; {((p.totalDurationMs as number || 0) / 1000).toFixed(1)}s
                </p>
            </motion.div>
        );
    }

    const description = describePayload(event.source, event.type, event.payload);

    return (
        <div className="relative">
            {/* Connector arrow */}
            {showConnector && event.depth > 0 && (
                <div className="flex items-center justify-center py-1">
                    <div className="flex flex-col items-center">
                        <div className="w-px h-4 bg-gradient-to-b from-gray-300 to-gray-200" />
                        <span className="text-gray-400 font-medium" style={{ fontSize: '12px' }}>triggered</span>
                        <svg className="w-3 h-3 text-gray-400" viewBox="0 0 12 12" fill="currentColor">
                            <path d="M6 9L2 5h8L6 9z" />
                        </svg>
                    </div>
                </div>
            )}

            {/* Event card */}
            <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                onClick={() => setExpanded(!expanded)}
                className={`
                    mx-3 mb-2 rounded-xl border cursor-pointer
                    transition-all duration-200 hover:shadow-md
                    ${config.bg} ${config.border}
                    ${isLatest ? 'ring-2 ring-emerald-300 shadow-md' : 'shadow-sm'}
                `}
            >
                {/* Header */}
                <div className="px-5 py-4 flex items-start gap-3">
                    {/* Agent icon + pulse */}
                    <div className="relative flex-shrink-0 mt-0.5">
                        <span style={{ fontSize: '24px' }}>{config.icon}</span>
                        {isLatest && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`font-bold ${config.color}`} style={{ fontSize: '18px' }}>
                                {config.label}
                            </span>
                            {event.durationMs && event.durationMs > 0 && (
                                <span className="text-gray-400" style={{ fontSize: '14px' }}>
                                    {(event.durationMs / 1000).toFixed(1)}s
                                </span>
                            )}
                        </div>
                        <p className="text-gray-800 leading-relaxed" style={{ fontSize: '18px' }}>
                            {event.summary}
                        </p>
                    </div>

                    {/* Expand indicator */}
                    <svg
                        className={`w-5 h-5 text-gray-400 transition-transform mt-1 ${expanded ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20" fill="currentColor"
                    >
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </div>

                {/* Expanded detail — human-readable paragraph */}
                {expanded && description && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="px-5 pb-4 border-t border-gray-200/60"
                    >
                        <p className="text-gray-600 leading-relaxed mt-3" style={{ fontSize: '18px' }}>
                            {description}
                        </p>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}
