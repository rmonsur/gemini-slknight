/**
 * Tile.tsx — Individual isometric tile component
 * 
 * Maps tile types to SVG assets and renders them with proper isometric positioning.
 */
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import type { TileType, MazeTaskType } from './types';

// Map tile types to their SVG assets
const TILE_ASSETS: Record<TileType, string> = {
    TODAY: '/tiles/today.svg',
    DOCUMENT_SCAN: '/tiles/document.svg',
    IDR_ENROLLMENT: '/tiles/idr.svg',
    REFINANCING: '/tiles/refinance.svg',
    GRANT_APPLICATION: '/tiles/grant.svg',
    AGGRESSIVE_PAYOFF: '/tiles/payoff.svg',
    PSLF: '/tiles/pslf.svg',
    COACH: '/tiles/coach.svg',
    CALL_SERVICER: '/tiles/call.svg',
    DEBT_FREE: '/tiles/freedom.svg',
};

// Tile labels for display
const TILE_LABELS: Record<TileType, string> = {
    TODAY: 'Start Here',
    DOCUMENT_SCAN: 'Scan Documents',
    IDR_ENROLLMENT: 'IDR Plan',
    REFINANCING: 'Refinance Decision',
    GRANT_APPLICATION: 'Apply for Grant',
    AGGRESSIVE_PAYOFF: 'Aggressive Payoff',
    PSLF: 'Public Service',
    COACH: 'Coach Session',
    CALL_SERVICER: 'Call Servicer',
    DEBT_FREE: 'Freedom!',
};

export interface TileProps {
    id: string;
    tileType: TileType;
    position: { row: number; col: number };
    isUnlocked: boolean;
    isActive: boolean;
    isCompleted: boolean;
    taskInstruction?: string;
    onClick?: () => void;
}

// Isometric constants
const TILE_WIDTH = 160;  // Width of tile in pixels
const TILE_HEIGHT = 100; // Height of tile (for isometric projection)
const ROW_OFFSET = 80;   // Vertical spacing between rows
const COL_OFFSET = 100;  // Horizontal offset for zigzag

export function Tile({
    id,
    tileType,
    position,
    isUnlocked,
    isActive,
    isCompleted,
    taskInstruction,
    onClick,
}: TileProps) {
    const asset = TILE_ASSETS[tileType];
    const label = TILE_LABELS[tileType];

    // Calculate isometric position
    // Zigzag pattern: alternate columns based on row
    const x = 50 + (position.col * COL_OFFSET);
    const y = 50 + (position.row * ROW_OFFSET);

    return (
        <motion.div
            className={`absolute cursor-pointer select-none`}
            style={{
                left: x,
                top: y,
                width: TILE_WIDTH,
                height: TILE_HEIGHT + 40,
                zIndex: 100 - position.row, // Tiles lower on screen appear in front
            }}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{
                opacity: isUnlocked ? 1 : 0.3,
                scale: isActive ? 1.1 : 1,
                y: 0,
            }}
            whileHover={isUnlocked ? { scale: 1.08, y: -5 } : undefined}
            whileTap={isUnlocked ? { scale: 0.98 } : undefined}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={isUnlocked ? onClick : undefined}
        >
            {/* Glow effect for active tile */}
            {isActive && (
                <motion.div
                    className="absolute inset-0 rounded-full bg-indigo-500/30 blur-xl"
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                />
            )}

            {/* Tile image */}
            <div className="relative w-full h-full">
                <Image
                    src={asset}
                    alt={label}
                    width={TILE_WIDTH}
                    height={TILE_HEIGHT + 20}
                    className={`transition-all duration-300 ${!isUnlocked ? 'grayscale' : ''
                        } ${isCompleted ? 'opacity-60' : ''}`}
                    style={{
                        filter: isActive ? 'drop-shadow(0 0 20px rgba(99, 102, 241, 0.5))' : undefined,
                    }}
                />

                {/* Completed checkmark */}
                {isCompleted && (
                    <motion.div
                        className="absolute top-2 right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                    >
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </motion.div>
                )}

                {/* Lock icon for locked tiles */}
                {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 bg-slate-800/80 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </div>
                )}
            </div>

            {/* Label */}
            <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-center whitespace-nowrap
                px-3 py-1 rounded-full text-xs font-medium transition-all
                ${isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                    : isCompleted
                        ? 'bg-green-600/80 text-white'
                        : isUnlocked
                            ? 'bg-slate-700/90 text-white'
                            : 'bg-slate-800/60 text-slate-400'
                }`}
            >
                {label}
            </div>

            {/* Task instruction tooltip (visible on hover for active tiles) */}
            {isActive && taskInstruction && (
                <motion.div
                    className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white 
                        text-xs px-4 py-2 rounded-lg max-w-[200px] text-center shadow-xl border border-indigo-500/30"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    {taskInstruction}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 
                        w-2 h-2 bg-slate-900 border-r border-b border-indigo-500/30" />
                </motion.div>
            )}
        </motion.div>
    );
}

export { TILE_ASSETS, TILE_LABELS };
