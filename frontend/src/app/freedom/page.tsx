// @ts-nocheck - Complex SSE types
'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FutureSelfChat from '@/components/freedom/FutureSelfChat';
import HawkDoveDebate from '@/components/freedom/HawkDoveDebate';
import { IsometricMaze, GameCard, type MazeTile, type MazeBlueprint, type GameState } from '@/components/maze';

// Types
interface OptimalOutcome {
    debtFreeDate: string;
    totalInterestPaid: number;
    qualityOfLifeScore: number;
    strategyName: string;
    narrativeSummary: string;
    totalSaved: number;
}

interface DecisionPoint {
    question: string;
    hawkPosition: string;
    dovePosition: string;
}

interface FreedomPath {
    optimalOutcome: OptimalOutcome;
    milestones: unknown[];
    mazeBlueprint?: MazeBlueprint;
    generatedAt: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// Empty isometric grid for landing state
function EmptyIsometricGrid() {
    const tiles = Array.from({ length: 16 }, (_, i) => ({
        row: Math.floor(i / 4),
        col: i % 4,
    }));

    return (
        <div className="absolute inset-0 flex items-center justify-center">
            <div
                className="relative"
                style={{
                    transform: 'rotateX(55deg) rotateZ(-45deg)',
                    transformStyle: 'preserve-3d',
                }}
            >
                {tiles.map((tile, i) => (
                    <motion.div
                        key={i}
                        className="absolute"
                        style={{
                            left: tile.col * 140,
                            top: tile.row * 140,
                            width: 110,
                            height: 110,
                            transformStyle: 'preserve-3d',
                        }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                    >
                        {/* Top face */}
                        <motion.div
                            className="w-full h-full rounded-xl border border-white/10 bg-slate-800/40"
                            style={{ transform: 'translateZ(30px)' }}
                            animate={{ opacity: [0.3, 0.5, 0.3] }}
                            transition={{ duration: 3, repeat: Infinity, delay: i * 0.2 }}
                        />
                        {/* Depth face */}
                        <div
                            className="absolute w-full rounded-b-xl bg-slate-900/40"
                            style={{
                                height: 30,
                                bottom: -15,
                                transform: 'rotateX(-90deg)',
                                transformOrigin: 'top',
                            }}
                        />
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

export default function FreedomPage() {
    // Game state machine
    const [gameState, setGameState] = useState<GameState>('LANDING');
    const [completedTileIds, setCompletedTileIds] = useState<Set<string>>(new Set());
    const [triggerUnlock, setTriggerUnlock] = useState(0);

    // Data state
    const [streamingNarrative, setStreamingNarrative] = useState('');
    const [freedomPath, setFreedomPath] = useState<FreedomPath | null>(null);
    const [activeTile, setActiveTile] = useState<MazeTile | null>(null);

    // Modals
    const [showFutureSelfChat, setShowFutureSelfChat] = useState(false);
    const [activeDebate, setActiveDebate] = useState<DecisionPoint | null>(null);

    const handleGenerate = useCallback(async (whatIf?: string) => {
        setGameState('GENERATING');
        setStreamingNarrative('');
        setFreedomPath(null);
        setCompletedTileIds(new Set());
        setTriggerUnlock(0);

        try {
            const response = await fetch(`${API_BASE}/api/simulator/freedom-path`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ whatIf: whatIf || undefined }),
            });

            if (!response.ok) throw new Error('Failed to generate');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No reader');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;

                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'narrative') {
                            setStreamingNarrative(prev => prev + data.text);
                        } else if (data.type === 'freedomPath') {
                            setFreedomPath(data.data);
                        } else if (data.type === 'done') {
                            // Done
                        }
                    } catch (e) {
                        // Parse error, skip
                    }
                }
            }
        } catch (error) {
            console.error('Error generating Freedom Path:', error);
        } finally {
            setGameState(prev => prev === 'GENERATING' ? 'PLAYING' : prev);
        }
    }, []);

    // Compute next available task
    const blueprint = freedomPath?.mazeBlueprint;

    const nextTask = useMemo(() => {
        if (!blueprint) return null;
        // First tile is always unlocked (TODAY). Find first tile that hasn't been completed.
        // The unlocked set in IsometricMaze starts with just TODAY, so we look for the first
        // non-completed tile after TODAY.
        const todayTile = blueprint.tiles.find(t => t.tileType === 'TODAY');
        const todayId = todayTile?.milestoneId;

        for (const tile of blueprint.tiles) {
            if (tile.milestoneId === todayId) continue; // skip TODAY
            if (!completedTileIds.has(tile.milestoneId)) {
                return tile;
            }
        }
        return null;
    }, [blueprint, completedTileIds]);

    const handleNextTask = useCallback(() => {
        if (nextTask) {
            setActiveTile(nextTask);
            setGameState('TASK_DETAIL');
        }
    }, [nextTask]);

    const handleTileClick = useCallback((tile: MazeTile) => {
        setActiveTile(tile);
        setGameState('TASK_DETAIL');
    }, []);

    const handleComplete = useCallback((tileId: string) => {
        setCompletedTileIds(prev => new Set([...prev, tileId]));
        setTriggerUnlock(prev => prev + 1);
        setGameState('PLAYING');
        setActiveTile(null);
    }, []);

    const handleBack = useCallback(() => {
        setGameState('PLAYING');
        setActiveTile(null);
    }, []);

    const handleStartTask = useCallback((tile: MazeTile) => {
        // Route to corresponding agent tool based on task type
        if (tile.requiredTask.type === 'FUTURE_SELF') {
            setShowFutureSelfChat(true);
        } else if (tile.requiredTask.type === 'HAWK_DOVE_DEBATE') {
            // Find the matching milestone's decision point if available
            setActiveDebate({
                question: tile.requiredTask.instruction,
                hawkPosition: 'Aggressive approach: prioritize speed of repayment',
                dovePosition: 'Conservative approach: prioritize quality of life',
            });
        } else {
            // MVP: log and let user click Complete
            console.log('Starting task for tile:', tile.milestoneId, tile.requiredTask.type);
        }
    }, []);

    const debtFreeYear = freedomPath?.optimalOutcome.debtFreeDate?.split('-')[0] || '2030';

    return (
        <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950">
            {/* Layer 1: Full-screen maze or empty grid */}
            {blueprint && gameState !== 'LANDING' ? (
                <div className="absolute inset-0">
                    <IsometricMaze
                        blueprint={blueprint}
                        demoMode={true}
                        triggerUnlock={triggerUnlock}
                        onTileClick={handleTileClick}
                    />
                </div>
            ) : (
                <EmptyIsometricGrid />
            )}

            {/* Layer 2: Title overlay (top-center) */}
            <div className="absolute top-8 left-0 right-0 pointer-events-none z-20 text-center">
                <h1 className="text-3xl font-bold text-white drop-shadow-lg">
                    Student Loan Knight
                </h1>
                <p className="text-white/60 text-sm mt-1">
                    Find Financial Freedom
                </p>
                <p className="text-emerald-400/80 text-xs mt-1 font-medium tracking-wide">
                    Gemini is your Game Master
                </p>
            </div>

            {/* Layer 3: GameCard (top-right) */}
            <GameCard
                gameState={gameState}
                streamingNarrative={streamingNarrative}
                freedomPath={freedomPath}
                activeTile={activeTile}
                onGenerate={handleGenerate}
                onNextTask={handleNextTask}
                onStartTask={handleStartTask}
                onComplete={handleComplete}
                onBack={handleBack}
            />

            {/* Layer 4: Modals */}
            <AnimatePresence>
                {showFutureSelfChat && freedomPath && (
                    <FutureSelfChat
                        freedomPath={freedomPath}
                        debtFreeYear={debtFreeYear}
                        onClose={() => setShowFutureSelfChat(false)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {activeDebate && (
                    <HawkDoveDebate
                        decisionPoint={activeDebate}
                        onClose={() => setActiveDebate(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
