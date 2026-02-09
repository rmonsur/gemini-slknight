'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MazeTile, MazeBlueprint } from './types';

// Grid configuration
const GRID_ROWS = 10;
const GRID_COLS = 10;
const TILE_SIZE = 100;
const TILE_GAP = 120; // spacing between tile centers

const TILE_COLORS: Record<string, string> = {
    TODAY: 'from-slate-600 to-slate-700',
    DOCUMENT_SCAN: 'from-amber-700 to-amber-800',
    IDR_ENROLLMENT: 'from-teal-600 to-teal-700',
    REFINANCING: 'from-orange-600 to-orange-700',
    GRANT_APPLICATION: 'from-green-600 to-green-700',
    AGGRESSIVE_PAYOFF: 'from-rose-600 to-rose-700',
    PSLF: 'from-blue-600 to-blue-700',
    DEBT_FREE: 'from-emerald-500 to-teal-500',
    COACH: 'from-purple-600 to-purple-700',
    CALL_SERVICER: 'from-indigo-600 to-indigo-700',
};

const TILE_ICONS: Record<string, string> = {
    TODAY: '📍',
    DOCUMENT_SCAN: '📜',
    IDR_ENROLLMENT: '🏛️',
    REFINANCING: '🌉',
    GRANT_APPLICATION: '🌳',
    AGGRESSIVE_PAYOFF: '⛰️',
    PSLF: '🏛️',
    DEBT_FREE: '🗽',
    COACH: '🔥',
    CALL_SERVICER: '📡',
};

const TILE_PIN_LABELS: Record<string, string> = {
    TODAY: 'Start Here',
    DOCUMENT_SCAN: 'Scan Docs',
    IDR_ENROLLMENT: 'IDR Plan',
    REFINANCING: 'Refinance',
    GRANT_APPLICATION: 'Apply Grant',
    AGGRESSIVE_PAYOFF: 'Pay Down',
    PSLF: 'PSLF',
    DEBT_FREE: 'Freedom!',
    COACH: 'Coach',
    CALL_SERVICER: 'Call Servicer',
};

interface IsometricMazeProps {
    blueprint?: MazeBlueprint | null;
    demoMode?: boolean;
    triggerUnlock?: number;
    onTileClick?: (tile: MazeTile) => void;
}

export function IsometricMaze({ blueprint, demoMode = false, triggerUnlock = 0, onTileClick }: IsometricMazeProps) {
    const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
    const [activeTileId, setActiveTileId] = useState<string | null>(null);
    const [revealingId, setRevealingId] = useState<string | null>(null);

    // Build a lookup: "row,col" -> MazeTile for quick grid cell checks
    const tileMap = useMemo(() => {
        const map = new Map<string, MazeTile>();
        if (blueprint) {
            for (const tile of blueprint.tiles) {
                map.set(`${tile.position.row},${tile.position.col}`, tile);
            }
        }
        return map;
    }, [blueprint]);

    // Initialize: unlock first tile (TODAY)
    useEffect(() => {
        if (blueprint && blueprint.tiles.length > 0) {
            const todayTile = blueprint.tiles.find(t => t.tileType === 'TODAY') || blueprint.tiles[0];
            setUnlockedIds(new Set([todayTile.milestoneId]));
            setActiveTileId(todayTile.milestoneId);
        }
    }, [blueprint]);

    // Demo mode: auto-unlock with Shift+D
    useEffect(() => {
        if (!demoMode || !blueprint) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.shiftKey && e.key === 'D') {
                const nextLocked = blueprint.tiles.find(t => !unlockedIds.has(t.milestoneId));
                if (nextLocked) {
                    setRevealingId(nextLocked.milestoneId);
                    setTimeout(() => {
                        setUnlockedIds(prev => new Set([...prev, nextLocked.milestoneId]));
                        setRevealingId(null);
                        setActiveTileId(nextLocked.milestoneId);
                    }, 1500);
                }
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [demoMode, blueprint, unlockedIds]);

    // Parent-triggered unlock
    useEffect(() => {
        if (triggerUnlock === 0 || !blueprint) return;
        const nextLocked = blueprint.tiles.find(t => !unlockedIds.has(t.milestoneId));
        if (nextLocked) {
            setRevealingId(nextLocked.milestoneId);
            setTimeout(() => {
                setUnlockedIds(prev => new Set([...prev, nextLocked.milestoneId]));
                setRevealingId(null);
                setActiveTileId(nextLocked.milestoneId);
            }, 1500);
        }
    }, [triggerUnlock]);

    // Arrow key navigation
    useEffect(() => {
        if (!blueprint) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.shiftKey) return;
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            e.preventDefault();

            const currentIdx = blueprint.tiles.findIndex(t => t.milestoneId === activeTileId);
            let targetIdx = currentIdx;

            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                targetIdx = Math.max(0, currentIdx - 1);
            } else {
                targetIdx = Math.min(blueprint.tiles.length - 1, currentIdx + 1);
            }

            const target = blueprint.tiles[targetIdx];
            if (target && unlockedIds.has(target.milestoneId)) {
                setActiveTileId(target.milestoneId);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [activeTileId, blueprint, unlockedIds]);

    const handleTileClick = useCallback((tile: MazeTile) => {
        if (!unlockedIds.has(tile.milestoneId)) return;
        setActiveTileId(tile.milestoneId);
        onTileClick?.(tile);
    }, [unlockedIds, onTileClick]);

    // Compute total grid dimensions for centering
    const gridWidth = GRID_COLS * TILE_GAP;
    const gridHeight = GRID_ROWS * TILE_GAP;

    return (
        <div className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
            {/* Isometric transform wrapper — centered on viewport */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div
                    className="relative pointer-events-auto"
                    style={{
                        width: gridWidth,
                        height: gridHeight,
                        transform: 'rotateX(55deg) rotateZ(-45deg)',
                        transformStyle: 'preserve-3d',
                    }}
                >
                    {/* Base grid cells */}
                    {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
                        const row = Math.floor(i / GRID_COLS);
                        const col = i % GRID_COLS;
                        const key = `${row},${col}`;
                        const mazeTile = tileMap.get(key);

                        // If there's a maze tile at this position, render the game tile
                        if (mazeTile) {
                            const isUnlocked = unlockedIds.has(mazeTile.milestoneId);
                            const isActive = activeTileId === mazeTile.milestoneId;
                            const isRevealing = revealingId === mazeTile.milestoneId;

                            return (
                                <motion.div
                                    key={`tile-${row}-${col}`}
                                    className="absolute cursor-pointer"
                                    style={{
                                        left: col * TILE_GAP,
                                        top: row * TILE_GAP,
                                        width: TILE_SIZE,
                                        height: TILE_SIZE,
                                        transformStyle: 'preserve-3d',
                                    }}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{
                                        opacity: 1,
                                        scale: isActive ? 1.12 : 1,
                                        z: isActive ? 20 : 0,
                                    }}
                                    transition={{ duration: 0.4, delay: 0.05 * (row + col) }}
                                    onClick={() => handleTileClick(mazeTile)}
                                >
                                    {/* Top face */}
                                    <div
                                        className={`
                                            w-full h-full rounded-xl border-2 transition-all duration-500
                                            flex flex-col items-center justify-center relative overflow-hidden
                                            ${isActive ? 'border-emerald-400 shadow-lg shadow-emerald-500/30' : 'border-white/30'}
                                            ${isUnlocked ? `bg-gradient-to-br ${TILE_COLORS[mazeTile.tileType] || TILE_COLORS.TODAY}` : 'bg-slate-700/80'}
                                        `}
                                        style={{ transform: 'translateZ(30px)' }}
                                    >
                                        {/* Gradient overlay */}
                                        {isUnlocked && (
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                                        )}

                                        {/* Fog overlay */}
                                        <AnimatePresence>
                                            {!isUnlocked && !isRevealing && (
                                                <motion.div
                                                    className="absolute inset-0 bg-slate-800/80 backdrop-blur-sm rounded-xl flex items-center justify-center"
                                                    exit={{ opacity: 0, scale: 1.2 }}
                                                    transition={{ duration: 1.5 }}
                                                >
                                                    <span className="text-2xl opacity-30">?</span>
                                                </motion.div>
                                            )}
                                            {isRevealing && (
                                                <motion.div
                                                    className="absolute inset-0 bg-emerald-400/20 rounded-xl"
                                                    initial={{ opacity: 1 }}
                                                    animate={{ opacity: [1, 0.5, 0] }}
                                                    transition={{ duration: 1.5 }}
                                                >
                                                    {[0, 1, 2, 3].map(j => (
                                                        <motion.div
                                                            key={j}
                                                            className="absolute w-2 h-2 bg-emerald-300 rounded-full"
                                                            initial={{ x: TILE_SIZE / 2, y: TILE_SIZE / 2, opacity: 1 }}
                                                            animate={{
                                                                x: TILE_SIZE / 2 + Math.cos(j * Math.PI / 2) * 60,
                                                                y: TILE_SIZE / 2 + Math.sin(j * Math.PI / 2) * 60,
                                                                opacity: 0,
                                                            }}
                                                            transition={{ duration: 1, delay: 0.2 }}
                                                        />
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Icon */}
                                        {isUnlocked && (
                                            <div className="relative z-10">
                                                <span className="text-2xl">{TILE_ICONS[mazeTile.tileType] || '🔷'}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Map pin label */}
                                    {isUnlocked && (
                                        <div
                                            className="absolute left-1/2 z-30 pointer-events-none"
                                            style={{
                                                top: -55,
                                                transform: 'translateZ(60px) translateX(-50%) rotateZ(45deg) rotateX(-55deg)',
                                            }}
                                        >
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.4, delay: 0.3 }}
                                                className="flex flex-col items-center"
                                            >
                                                <div className={`
                                                    px-3 py-1.5 rounded-full text-white text-xs font-semibold whitespace-nowrap shadow-lg
                                                    ${isActive ? 'bg-emerald-500 shadow-emerald-500/40' : 'bg-black/70 backdrop-blur-sm'}
                                                `}>
                                                    {TILE_PIN_LABELS[mazeTile.tileType] || mazeTile.tileType}
                                                </div>
                                                <div className={`w-0.5 h-3 ${isActive ? 'bg-emerald-500' : 'bg-black/50'}`} />
                                                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-black/40'}`} />
                                            </motion.div>
                                        </div>
                                    )}

                                    {/* 3D depth face */}
                                    <div
                                        className={`absolute w-full rounded-b-xl ${isUnlocked ? 'bg-slate-700' : 'bg-slate-800'}`}
                                        style={{
                                            height: 25,
                                            bottom: -12,
                                            transform: 'rotateX(-90deg)',
                                            transformOrigin: 'top',
                                        }}
                                    />

                                    {/* Active bouncing indicator */}
                                    {isActive && isUnlocked && (
                                        <motion.div
                                            className="absolute -top-16 left-1/2 z-20"
                                            style={{ transform: 'translateZ(80px) translateX(-50%) rotateZ(45deg) rotateX(-55deg)' }}
                                            animate={{ y: [0, -5, 0] }}
                                            transition={{ repeat: Infinity, duration: 1.5 }}
                                        >
                                            <div className="w-6 h-6 bg-emerald-400 rounded-full shadow-lg shadow-emerald-400/50 flex items-center justify-center text-xs">
                                                ▼
                                            </div>
                                        </motion.div>
                                    )}
                                </motion.div>
                            );
                        }

                        // Empty grid cell — subtle placeholder diamond
                        return (
                            <motion.div
                                key={`grid-${row}-${col}`}
                                className="absolute"
                                style={{
                                    left: col * TILE_GAP,
                                    top: row * TILE_GAP,
                                    width: TILE_SIZE,
                                    height: TILE_SIZE,
                                    transformStyle: 'preserve-3d',
                                }}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3, delay: 0.02 * (row + col) }}
                            >
                                <motion.div
                                    className="w-full h-full rounded-xl border border-white/[0.08] bg-white/[0.04]"
                                    style={{ transform: 'translateZ(2px)' }}
                                    animate={{ opacity: [0.3, 0.5, 0.3] }}
                                    transition={{ duration: 4, repeat: Infinity, delay: (row + col) * 0.15 }}
                                />
                            </motion.div>
                        );
                    })}

                    {/* Connecting paths between maze tiles */}
                    {blueprint && blueprint.tiles.map((tile, i) => {
                        if (i === blueprint.tiles.length - 1) return null;
                        const next = blueprint.tiles[i + 1];
                        const x1 = tile.position.col * TILE_GAP + TILE_SIZE / 2;
                        const y1 = tile.position.row * TILE_GAP + TILE_SIZE / 2;
                        const x2 = next.position.col * TILE_GAP + TILE_SIZE / 2;
                        const y2 = next.position.row * TILE_GAP + TILE_SIZE / 2;
                        const bothUnlocked = unlockedIds.has(tile.milestoneId) && unlockedIds.has(next.milestoneId);

                        return (
                            <div
                                key={`path-${i}`}
                                className={`absolute h-1 origin-left transition-all duration-1000 ${bothUnlocked ? 'bg-emerald-400/60' : 'bg-white/10'}`}
                                style={{
                                    left: x1,
                                    top: y1,
                                    width: Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
                                    transform: `translateZ(25px) rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`,
                                }}
                            />
                        );
                    })}
                </div>
            </div>

            {/* HUD overlays */}
            {blueprint && (
                <>
                    <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs font-medium pointer-events-auto">
                        {unlockedIds.size} / {blueprint.totalTiles} tiles unlocked
                    </div>
                    <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 text-white/70 text-xs pointer-events-auto">
                        Arrow keys to navigate{demoMode ? ' • Shift+D to unlock next' : ''}
                    </div>
                </>
            )}
        </div>
    );
}
