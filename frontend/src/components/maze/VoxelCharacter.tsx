/**
 * VoxelCharacter.tsx — Animated voxel player character
 * 
 * Renders the player avatar on the current tile with idle animations.
 */
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface VoxelCharacterProps {
    /** Current position on the maze grid */
    position: { row: number; col: number };
    /** Whether the character is currently moving */
    isMoving: boolean;
    /** Direction of movement for animation */
    direction?: 'up' | 'down' | 'left' | 'right';
}

// Match tile positioning constants
const TILE_WIDTH = 160;
const ROW_OFFSET = 80;
const COL_OFFSET = 100;
const CHARACTER_SIZE = 48;

export function VoxelCharacter({ position, isMoving, direction }: VoxelCharacterProps) {
    // Calculate character position (centered on tile)
    const x = 50 + (position.col * COL_OFFSET) + (TILE_WIDTH / 2) - (CHARACTER_SIZE / 2);
    const y = 50 + (position.row * ROW_OFFSET) + 20; // Slightly above tile center

    return (
        <motion.div
            className="absolute pointer-events-none"
            style={{
                width: CHARACTER_SIZE,
                height: CHARACTER_SIZE + 16,
                zIndex: 200, // Always above tiles
            }}
            initial={{ x, y, opacity: 0, scale: 0.5 }}
            animate={{
                x,
                y,
                opacity: 1,
                scale: 1,
            }}
            transition={{
                type: 'spring',
                stiffness: 200,
                damping: 20,
            }}
        >
            {/* Shadow */}
            <motion.div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-3 bg-black/30 rounded-full blur-sm"
                animate={{
                    scaleX: isMoving ? [1, 0.8, 1] : [1, 1.1, 1],
                    opacity: isMoving ? 0.4 : 0.3,
                }}
                transition={{
                    duration: isMoving ? 0.3 : 1.5,
                    repeat: Infinity,
                }}
            />

            {/* Character sprite */}
            <motion.div
                className="relative"
                animate={{
                    y: isMoving ? [0, -8, 0] : [0, -3, 0],
                    rotate: isMoving
                        ? (direction === 'left' ? [-5, 5, -5] : direction === 'right' ? [5, -5, 5] : 0)
                        : 0,
                }}
                transition={{
                    duration: isMoving ? 0.3 : 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            >
                <Image
                    src="/character/player.svg"
                    alt="Player"
                    width={CHARACTER_SIZE}
                    height={CHARACTER_SIZE}
                    className="drop-shadow-lg"
                />

                {/* Glow effect when moving */}
                {isMoving && (
                    <motion.div
                        className="absolute inset-0 rounded-full bg-indigo-400/40 blur-md"
                        animate={{ opacity: [0.5, 0.8, 0.5] }}
                        transition={{ duration: 0.2, repeat: Infinity }}
                    />
                )}
            </motion.div>

            {/* Sparkle effect */}
            <motion.div
                className="absolute -right-1 -top-1 w-3 h-3"
                animate={{
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0],
                    rotate: [0, 180, 360],
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: 1,
                }}
            >
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-yellow-200">
                    <path
                        d="M12 2L13.5 9L20 12L13.5 15L12 22L10.5 15L4 12L10.5 9L12 2Z"
                        fill="currentColor"
                    />
                </svg>
            </motion.div>
        </motion.div>
    );
}
