// @ts-nocheck
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AgentEventCard, type AgentEvent } from './AgentEventCard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface AgentActivityFeedProps {
    /** When true, feed shows a waiting state instead of connecting */
    idle?: boolean;
}

export function AgentActivityFeed({ idle = false }: AgentActivityFeedProps) {
    const [events, setEvents] = useState<AgentEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const [liveChainId, setLiveChainId] = useState<string | null>(null);
    const feedRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Connect to SSE feed
    useEffect(() => {
        if (idle) return;

        let retryTimeout: ReturnType<typeof setTimeout>;

        function connect() {
            const es = new EventSource(`${API_BASE}/api/orchestrator/feed`);
            eventSourceRef.current = es;

            es.onopen = () => setConnected(true);

            es.onmessage = (msg) => {
                try {
                    const event: AgentEvent = JSON.parse(msg.data);
                    setEvents(prev => {
                        // Deduplicate by ID
                        if (prev.some(e => e.id === event.id)) return prev;
                        const next = [...prev, event];
                        // Keep last 100 events
                        return next.length > 100 ? next.slice(-100) : next;
                    });

                    // Track active chain
                    if (event.depth === 0) {
                        setLiveChainId(event.chainId);
                    }
                    if (event.depth === -1) {
                        // Chain summary = chain complete
                        setTimeout(() => setLiveChainId(null), 2000);
                    }
                } catch { /* skip malformed */ }
            };

            es.onerror = () => {
                setConnected(false);
                es.close();
                retryTimeout = setTimeout(connect, 3000);
            };
        }

        connect();

        return () => {
            eventSourceRef.current?.close();
            clearTimeout(retryTimeout);
        };
    }, [idle]);

    // Auto-scroll to bottom when new events arrive
    useEffect(() => {
        if (feedRef.current) {
            feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
    }, [events]);

    // Group events by chain for visual separation
    const currentChainEvents = liveChainId
        ? events.filter(e => e.chainId === liveChainId)
        : [];
    const pastEvents = events.filter(e => !liveChainId || e.chainId !== liveChainId);

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    {liveChainId ? (
                        <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    ) : connected ? (
                        <span className="w-3 h-3 bg-emerald-500 rounded-full" />
                    ) : (
                        <span className="w-3 h-3 bg-gray-300 rounded-full" />
                    )}
                    <span className="text-gray-900 font-bold" style={{ fontSize: '18px' }}>
                        {liveChainId ? 'LIVE' : connected ? 'Agent Feed' : 'Connecting...'}
                    </span>
                    {liveChainId && (
                        <span className="text-gray-400 font-mono" style={{ fontSize: '14px' }}>
                            {currentChainEvents.length} agent{currentChainEvents.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                {events.length > 0 && (
                    <button
                        onClick={() => setEvents([])}
                        className="text-gray-400 hover:text-gray-600 transition font-medium"
                        style={{ fontSize: '16px' }}
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* Feed */}
            <div
                ref={feedRef}
                className="flex-1 overflow-y-auto pb-4 pt-3 scroll-smooth"
                style={{ minHeight: 0 }}
            >
                {events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6">
                        <div className="text-5xl mb-4 opacity-40">🤖</div>
                        <p className="text-gray-500 text-center leading-relaxed" style={{ fontSize: '18px' }}>
                            {idle
                                ? 'Generate your path to see agents in action'
                                : connected
                                    ? 'Waiting for agent activity...'
                                    : 'Connecting to orchestrator...'
                            }
                        </p>
                        <p className="text-gray-400 text-center mt-2" style={{ fontSize: '16px' }}>
                            Upload a document or generate a path to trigger the agent chain
                        </p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {/* Past chain events (dimmed) */}
                        {pastEvents.map((event, i) => (
                            <AgentEventCard
                                key={event.id}
                                event={event}
                                isLatest={false}
                                showConnector={i > 0 && pastEvents[i - 1]?.chainId === event.chainId}
                            />
                        ))}

                        {/* Active chain events (highlighted) */}
                        {currentChainEvents.length > 0 && pastEvents.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="mx-5 my-3 border-t border-gray-200"
                            />
                        )}
                        {currentChainEvents.map((event, i) => (
                            <AgentEventCard
                                key={event.id}
                                event={event}
                                isLatest={i === currentChainEvents.length - 1}
                                showConnector={i > 0}
                            />
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
