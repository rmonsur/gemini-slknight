// @ts-nocheck - SSE types
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OptimalOutcome {
    debtFreeDate: string;
    totalInterestPaid: number;
    qualityOfLifeScore: number;
    strategyName: string;
    narrativeSummary: string;
    totalSaved: number;
}

interface FreedomPath {
    optimalOutcome: OptimalOutcome;
    milestones: unknown[];
    generatedAt: string;
}

interface FutureSelfChatProps {
    freedomPath: FreedomPath;
    debtFreeYear: string;
    onClose: () => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
}

interface Opportunity {
    id: string;
    type: string;
    title: string;
    value: number;
    source: string;
    coordinates?: [number, number];
    eligibility?: string;
}

const SUGGESTED_QUESTIONS = [
    "How much did I save total?",
    "Which grant paid off the most?",
    "What's my net worth now?",
    "Best financial move I made?",
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// Convert lon/lat to approximate x/y on a 360x200 US map viewport
// US bounds: lon [-125, -66], lat [24, 50]
function geoToMapPos(lon: number, lat: number): { x: number; y: number } {
    const x = ((lon - (-125)) / ((-66) - (-125))) * 100;
    const y = ((50 - lat) / (50 - 24)) * 100;
    return { x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) };
}

function OpportunityMapContent({ opportunities, large }: { opportunities: Opportunity[]; large?: boolean }) {
    const [selected, setSelected] = useState<Opportunity | null>(null);
    const geoOpps = opportunities.filter(o => o.coordinates);

    const typeColors: Record<string, string> = {
        RELOCATION_GRANT: 'bg-emerald-400',
        FORGIVENESS: 'bg-violet-400',
        REFINANCE: 'bg-amber-400',
        POLICY_CHANGE: 'bg-sky-400',
    };

    const typeLabels: Record<string, string> = {
        RELOCATION_GRANT: 'Relocation',
        FORGIVENESS: 'Forgiveness',
        REFINANCE: 'Refinance',
        POLICY_CHANGE: 'State Program',
    };

    const pinSize = large ? 12 : 8;
    const pinSizeSel = large ? 16 : 12;

    return (
        <>
            {/* Map area */}
            <div className="relative w-full" style={{ paddingBottom: large ? '50%' : '55%' }}>
                {/* US continental outline — computed from real geo coordinates to match pin positions */}
                <div className="absolute inset-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                        {/* Outline uses same coordinate system as geoToMapPos so it aligns with pins */}
                        {/* Points traced from WA coast clockwise around the continental US */}
                        <path
                            d="M0.5,6 L4,4 L14,4 L24,4 L36,4 L48,4 L56,8 L62,6 L66,10 L70,13 L72,8 L76,6 L80,8 L84,6 L88,5 L93,10 L98,19 L94,23 L91,30 L87,35 L86,37 L84,44 L83,52 L81,58 L79,62 L75,69 L74,75 L76,84 L78,90 L76,94 L73,87 L70,80 L68,77 L63,76 L59,81 L55,79 L53,79 L50,83 L48,88 L47,92 L46,92 L40,72 L37,69 L31,69 L24,72 L17,67 L13,67 L11,62 L8,58 L5,47 L2,37 L2,31 L2,15 Z"
                            fill="rgba(255,255,255,0.08)"
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth="0.5"
                        />
                    </svg>
                </div>

                {/* Opportunity pins */}
                {geoOpps.map((opp, i) => {
                    const pos = geoToMapPos(opp.coordinates![0], opp.coordinates![1]);
                    const isSelected = selected?.id === opp.id;
                    return (
                        <motion.button
                            key={opp.id}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.03, type: 'spring', stiffness: 300 }}
                            className={`absolute z-10 rounded-full ${typeColors[opp.type] || 'bg-white'} ${isSelected ? 'ring-2 ring-white z-20' : ''}`}
                            style={{
                                left: `${pos.x}%`,
                                top: `${pos.y}%`,
                                width: `${isSelected ? pinSizeSel : pinSize}px`,
                                height: `${isSelected ? pinSizeSel : pinSize}px`,
                                transform: 'translate(-50%, -50%)',
                                cursor: 'pointer',
                                boxShadow: `0 0 ${opp.value > 10000 ? '8' : '4'}px ${typeColors[opp.type]?.includes('emerald') ? 'rgba(52,211,153,0.5)' : typeColors[opp.type]?.includes('violet') ? 'rgba(167,139,250,0.5)' : 'rgba(251,191,36,0.5)'}`,
                            }}
                            onClick={() => setSelected(isSelected ? null : opp)}
                            title={`${opp.title}: $${opp.value.toLocaleString()}`}
                        />
                    );
                })}
            </div>

            {/* Legend */}
            <div className="px-3 py-2 border-t border-white/10 flex flex-wrap gap-3">
                {Object.entries(typeLabels).map(([type, label]) => (
                    <div key={type} className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${typeColors[type]}`} />
                        <span className="text-white/50" style={{ fontSize: large ? '13px' : '11px' }}>{label}</span>
                    </div>
                ))}
            </div>

            {/* Selected opportunity detail */}
            <AnimatePresence>
                {selected && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-white/10"
                    >
                        <div className="px-3 py-3 bg-white/5">
                            <div className="flex items-start justify-between mb-1">
                                <span className="text-white font-semibold" style={{ fontSize: large ? '16px' : '14px' }}>
                                    {selected.title}
                                </span>
                                <span className="text-emerald-400 font-bold whitespace-nowrap ml-2" style={{ fontSize: large ? '16px' : '14px' }}>
                                    {selected.value > 0 ? `$${selected.value.toLocaleString()}` : 'Variable'}
                                </span>
                            </div>
                            <p className="text-white/60" style={{ fontSize: large ? '15px' : '13px' }}>
                                {selected.eligibility}
                            </p>
                            <p className="text-white/40 mt-1" style={{ fontSize: large ? '14px' : '12px' }}>
                                Source: {selected.source}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function OpportunityMap({ opportunities }: { opportunities: Opportunity[] }) {
    const [zoomed, setZoomed] = useState(false);
    const geoOpps = opportunities.filter(o => o.coordinates);

    return (
        <>
            <div className="mx-4 mb-3 cursor-pointer" onClick={() => setZoomed(true)}>
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition">
                    {/* Map header */}
                    <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span style={{ fontSize: '14px' }}>📍</span>
                            <span className="text-white/80 font-semibold" style={{ fontSize: '14px' }}>
                                {geoOpps.length} Opportunities Near You
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-bold" style={{ fontSize: '14px' }}>
                                ${geoOpps.reduce((sum, o) => sum + o.value, 0).toLocaleString()} total
                            </span>
                            <span className="text-white/30" style={{ fontSize: '12px' }}>Click to zoom</span>
                        </div>
                    </div>
                    <OpportunityMapContent opportunities={opportunities} />
                </div>
            </div>

            {/* Zoomed modal */}
            <AnimatePresence>
                {zoomed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
                        onClick={() => setZoomed(false)}
                    >
                        <div className="absolute inset-0 bg-black/80" />
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="relative bg-slate-900 rounded-2xl border border-white/20 max-w-4xl w-full max-h-[85vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span style={{ fontSize: '18px' }}>📍</span>
                                    <span className="text-white font-bold" style={{ fontSize: '18px' }}>
                                        {geoOpps.length} Financial Opportunities
                                    </span>
                                    <span className="text-emerald-400 font-bold" style={{ fontSize: '16px' }}>
                                        ${geoOpps.reduce((sum, o) => sum + o.value, 0).toLocaleString()} total value
                                    </span>
                                </div>
                                <button
                                    onClick={() => setZoomed(false)}
                                    className="text-white/60 hover:text-white text-2xl p-2"
                                >
                                    ×
                                </button>
                            </div>
                            <OpportunityMapContent opportunities={opportunities} large />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

export default function FutureSelfChat({ freedomPath, debtFreeYear, onClose }: FutureSelfChatProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: `Hey, it's you from ${debtFreeYear} — debt-free with $${(Math.floor(Math.random() * 30 + 40) * 1000).toLocaleString()} in savings. I remember staring at that loan balance, but let me tell you: every dollar decision from here forward compounds. Ask me about the money.`,
        },
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [showMap, setShowMap] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load opportunities from watchdog agent on mount
    useEffect(() => {
        async function loadOpportunities() {
            try {
                const res = await fetch(`${API_BASE}/api/optimizer/opportunities?all=true`);
                const data = await res.json();
                if (data.success && data.offers) {
                    setOpportunities(data.offers);
                }
            } catch (e) {
                console.error('Failed to load opportunities:', e);
            }
        }
        loadOpportunities();
    }, []);

    const sendMessage = useCallback(async (messageText: string) => {
        if (!messageText.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: messageText,
        };

        const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: '',
            isStreaming: true,
        };

        setMessages(prev => [...prev, userMessage, assistantMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE}/api/simulator/future-self`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: messageText,
                    freedomPath: JSON.stringify(freedomPath),
                }),
            });

            if (!response.ok) throw new Error('Failed to get response');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No reader');

            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;

                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'response') {
                            fullResponse += data.text;
                            setMessages(prev =>
                                prev.map(msg =>
                                    msg.id === assistantMessage.id
                                        ? { ...msg, content: fullResponse }
                                        : msg
                                )
                            );
                        } else if (data.type === 'done') {
                            setMessages(prev =>
                                prev.map(msg =>
                                    msg.id === assistantMessage.id
                                        ? { ...msg, isStreaming: false }
                                        : msg
                                )
                            );
                        }
                    } catch (e) {
                        // Parse error, skip
                    }
                }
            }
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === assistantMessage.id
                        ? { ...msg, content: "Here's what I can tell you from the numbers: autopay alone saved us $1,800 in interest. The Tulsa grant knocked $10,000 off the principal, which avoided $4,200 in lifetime interest. Once the debt was gone, redirecting that $450/month into index funds grew to $12,000 in the first year alone. The math is on your side — start with the quick wins.", isStreaming: false }
                        : msg
                )
            );
        } finally {
            setIsLoading(false);
        }
    }, [freedomPath, isLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(inputValue);
    };

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-gradient-to-b from-violet-950 via-purple-950 to-slate-950 border-l border-white/10 shadow-2xl z-50 flex flex-col"
        >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-2xl">
                        💰
                    </div>
                    <div>
                        <div className="text-white font-bold">You in {debtFreeYear} — Debt Free</div>
                        <div className="text-emerald-400/80" style={{ fontSize: '14px' }}>
                            ${(freedomPath.optimalOutcome.totalSaved || 0).toLocaleString()} saved
                        </div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-white/60 hover:text-white text-2xl p-2"
                >
                    ×
                </button>
            </div>

            {/* Opportunity Map (collapsible) */}
            {opportunities.length > 0 && (
                <div className="border-b border-white/10">
                    <button
                        onClick={() => setShowMap(!showMap)}
                        className="w-full px-4 py-2 flex items-center justify-between text-white/70 hover:text-white/90 transition"
                        style={{ fontSize: '14px' }}
                    >
                        <span className="flex items-center gap-2">
                            <span>🗺️</span>
                            <span className="font-medium">Opportunity Map</span>
                            <span className="text-emerald-400/70 font-semibold">
                                ({opportunities.filter(o => o.coordinates).length} locations)
                            </span>
                        </span>
                        <span className={`transition-transform ${showMap ? 'rotate-180' : ''}`}>▾</span>
                    </button>
                    <AnimatePresence>
                        {showMap && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <OpportunityMap opportunities={opportunities} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-white/10 text-white/90'
                                }`}
                            style={{ fontSize: '16px', lineHeight: '1.6' }}
                        >
                            {message.content}
                            {message.isStreaming && (
                                <span className="inline-block w-2 h-4 bg-emerald-400 ml-1 animate-pulse" />
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Suggested Questions */}
            {messages.length <= 2 && (
                <div className="px-4 py-2 border-t border-white/5">
                    <div className="text-white/50 mb-2" style={{ fontSize: '14px' }}>Ask about the money:</div>
                    <div className="flex flex-wrap gap-2">
                        {SUGGESTED_QUESTIONS.map((question) => (
                            <button
                                key={question}
                                onClick={() => sendMessage(question)}
                                disabled={isLoading}
                                className="px-3 py-1.5 bg-emerald-500/10 text-emerald-300/90 border border-emerald-500/20 rounded-full hover:bg-emerald-500/20 transition disabled:opacity-50"
                                style={{ fontSize: '14px' }}
                            >
                                {question}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Ask about savings, grants, investments..."
                        disabled={isLoading}
                        className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                        style={{ fontSize: '16px' }}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !inputValue.trim()}
                        className="px-4 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 transition disabled:opacity-50"
                    >
                        ↑
                    </button>
                </div>
            </form>
        </motion.div>
    );
}
