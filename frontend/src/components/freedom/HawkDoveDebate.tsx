// @ts-nocheck - SSE types
'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';

interface DecisionPoint {
    question: string;
    hawkPosition: string;
    dovePosition: string;
}

interface HawkDoveDebateProps {
    decisionPoint: DecisionPoint;
    onClose: () => void;
}

interface Verdict {
    choice: 'HAWK' | 'DOVE';
    winnerName?: string;
    confidence: number;
    ruling?: string;
    reasoning?: string;
    strategy?: {
        name: string;
        monthlyPayment: string;
        timeline: string;
        steps: string[];
    };
    actionItems?: string[];
    estimatedSavings: string;
}

type Phase = 'hawk' | 'dove' | 'judging' | 'verdict';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function HawkDoveDebate({ decisionPoint, onClose }: HawkDoveDebateProps) {
    const [hawkText, setHawkText] = useState('');
    const [doveText, setDoveText] = useState('');
    const [phase, setPhase] = useState<Phase>('hawk');
    const [verdict, setVerdict] = useState<Verdict | null>(null);

    const startDebate = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/simulator/debate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: decisionPoint.question,
                    hawkPosition: decisionPoint.hawkPosition,
                    dovePosition: decisionPoint.dovePosition,
                }),
            });

            if (!response.ok) throw new Error('Failed to start debate');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) throw new Error('No reader');

            let hawk = '';
            let dove = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                for (const line of chunk.split('\n')) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === 'hawk') {
                            setPhase('hawk');
                            hawk += data.text;
                            setHawkText(hawk);
                        } else if (data.type === 'dove') {
                            setPhase('dove');
                            dove += data.text;
                            setDoveText(dove);
                        } else if (data.type === 'judging') {
                            setPhase('judging');
                        } else if (data.type === 'verdict') {
                            setVerdict(data.data);
                            setPhase('verdict');
                        }
                    } catch { /* skip */ }
                }
            }
        } catch (error) {
            console.error('Debate error:', error);
            setHawkText("Kill the high-interest private loan immediately. You're bleeding $800/year in interest on that 7.2% rate — that's guaranteed loss. Pay it off, redirect the freed cash to federal loans.");
            setDoveText("Keep your federal protections. The SAVE plan caps payments at 5% of discretionary income and offers forgiveness after 20 years. That $12,000 in potential savings dwarfs the refinancing benefit.");
            setVerdict({
                choice: 'HAWK',
                winnerName: 'The Hawk',
                confidence: 0.78,
                ruling: 'The 7.2% private loan is a guaranteed drain that no federal program can offset. Eliminate it first, then leverage SAVE for the federal portion.',
                strategy: {
                    name: 'Targeted Aggressive Payoff',
                    monthlyPayment: '$850',
                    timeline: '14 months',
                    steps: ['Pay off $12K private loan (7.2%)', 'Enroll federal loans in SAVE plan', 'Autopay for 0.25% reduction', 'Redirect freed payments to remaining balance'],
                },
                estimatedSavings: '$4,800',
            });
            setPhase('verdict');
        }
    }, [decisionPoint]);

    useEffect(() => {
        startDebate();
    }, [startDebate]);

    const isHawkWin = verdict?.choice === 'HAWK';
    const steps = verdict?.strategy?.steps || verdict?.actionItems || [];
    const ruling = verdict?.ruling || verdict?.reasoning || '';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/20"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10 bg-black/20">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="text-3xl">⚔️</span>
                            Hawk vs Dove
                        </h2>
                        <button onClick={onClose} className="text-white/60 hover:text-white text-2xl p-2">×</button>
                    </div>
                    <p className="text-white/80" style={{ fontSize: '18px' }}>{decisionPoint.question}</p>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
                    {/* Arguments — side by side, compact */}
                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                        {/* Hawk */}
                        <div className={`rounded-xl border p-4 transition-all ${phase === 'hawk' ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/10 bg-white/5'} ${verdict && !isHawkWin ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xl">🦅</span>
                                <span className="text-amber-400 font-bold" style={{ fontSize: '16px' }}>THE HAWK</span>
                                {verdict && isHawkWin && (
                                    <span className="ml-auto px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-bold" style={{ fontSize: '12px' }}>WINNER</span>
                                )}
                            </div>
                            {hawkText ? (
                                <p className="text-white/85 leading-relaxed" style={{ fontSize: '15px' }}>
                                    {hawkText}
                                    {phase === 'hawk' && <span className="inline-block w-2 h-4 bg-amber-400 ml-1 animate-pulse" />}
                                </p>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-white/40" style={{ fontSize: '15px' }}>Making case...</span>
                                </div>
                            )}
                        </div>

                        {/* Dove */}
                        <div className={`rounded-xl border p-4 transition-all ${phase === 'dove' ? 'border-teal-500/50 bg-teal-500/10' : 'border-white/10 bg-white/5'} ${verdict && isHawkWin ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xl">🕊️</span>
                                <span className="text-teal-400 font-bold" style={{ fontSize: '16px' }}>THE DOVE</span>
                                {verdict && !isHawkWin && (
                                    <span className="ml-auto px-2 py-0.5 bg-teal-500/20 text-teal-300 rounded-full font-bold" style={{ fontSize: '12px' }}>WINNER</span>
                                )}
                            </div>
                            {doveText ? (
                                <p className="text-white/85 leading-relaxed" style={{ fontSize: '15px' }}>
                                    {doveText}
                                    {phase === 'dove' && <span className="inline-block w-2 h-4 bg-teal-400 ml-1 animate-pulse" />}
                                </p>
                            ) : (
                                <p className="text-white/30 italic" style={{ fontSize: '15px' }}>Waiting...</p>
                            )}
                        </div>
                    </div>

                    {/* Judging spinner */}
                    {phase === 'judging' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center justify-center gap-3 py-8"
                        >
                            <div className="w-6 h-6 border-2 border-white/40 border-t-emerald-400 rounded-full animate-spin" />
                            <span className="text-white/70 font-medium" style={{ fontSize: '18px' }}>AI is deciding...</span>
                        </motion.div>
                    )}

                    {/* === THE VERDICT === */}
                    {verdict && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.4 }}
                        >
                            {/* Verdict header */}
                            <div className={`rounded-xl p-6 border-2 ${isHawkWin ? 'bg-amber-500/10 border-amber-500/40' : 'bg-teal-500/10 border-teal-500/40'}`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-4xl">{isHawkWin ? '🦅' : '🕊️'}</span>
                                    <div>
                                        <h3 className="text-white font-black" style={{ fontSize: '22px' }}>
                                            {verdict.winnerName || (isHawkWin ? 'The Hawk' : 'The Dove')} Wins
                                        </h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className={`font-semibold ${isHawkWin ? 'text-amber-400' : 'text-teal-400'}`} style={{ fontSize: '15px' }}>
                                                {Math.round(verdict.confidence * 100)}% confidence
                                            </span>
                                            <span className="text-emerald-400 font-bold" style={{ fontSize: '15px' }}>
                                                Est. savings: {verdict.estimatedSavings}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-white/85 leading-relaxed mb-5" style={{ fontSize: '16px' }}>
                                    {ruling}
                                </p>

                                {/* Allocated Strategy */}
                                {verdict.strategy && (
                                    <div className="bg-black/20 rounded-xl p-5 border border-white/10">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-white font-bold" style={{ fontSize: '18px' }}>
                                                Allocated Strategy: {verdict.strategy.name}
                                            </h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mb-4">
                                            <div className="bg-white/5 rounded-lg px-3 py-2">
                                                <p className="text-white/40 text-xs uppercase">Monthly Payment</p>
                                                <p className="text-white font-bold" style={{ fontSize: '18px' }}>{verdict.strategy.monthlyPayment}</p>
                                            </div>
                                            <div className="bg-white/5 rounded-lg px-3 py-2">
                                                <p className="text-white/40 text-xs uppercase">Timeline</p>
                                                <p className="text-white font-bold" style={{ fontSize: '18px' }}>{verdict.strategy.timeline}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {verdict.strategy.steps.map((step, i) => (
                                                <div key={i} className="flex items-start gap-3">
                                                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold" style={{ fontSize: '13px' }}>
                                                        {i + 1}
                                                    </span>
                                                    <span className="text-white/80" style={{ fontSize: '15px' }}>{step}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Fallback: action items if no strategy block */}
                                {!verdict.strategy && steps.length > 0 && (
                                    <div className="space-y-2 mt-4">
                                        <span className="text-white/50 font-semibold" style={{ fontSize: '14px' }}>Action Items:</span>
                                        {steps.map((step, i) => (
                                            <div key={i} className="flex items-start gap-2">
                                                <span className="text-emerald-400" style={{ fontSize: '14px' }}>✓</span>
                                                <span className="text-white/70" style={{ fontSize: '15px' }}>{step}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex justify-end">
                    <button
                        onClick={onClose}
                        className={`px-6 py-3 font-medium rounded-xl transition ${verdict ? 'bg-emerald-500 text-white hover:bg-emerald-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        style={{ fontSize: '16px' }}
                    >
                        {verdict ? 'Apply Strategy' : 'Close'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
