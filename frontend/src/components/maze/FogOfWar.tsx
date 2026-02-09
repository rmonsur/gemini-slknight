/**
 * FogOfWar.tsx — Fog overlay for locked tiles
 * 
 * Creates an animated fog effect that lifts when tiles are unlocked.
 * Inspired by Monument Valley's mysterious atmosphere.
 */
'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface FogParticle {
    id: number;
    x: number;
    y: number;
    size: number;
    duration: number;
    delay: number;
}

interface FogOfWarProps {
    /** Whether the fog is visible (true = area is locked) */
    isVisible: boolean;
    /** Callback when fog finishes dissipating */
    onDissipated?: () => void;
}

export function FogOfWar({ isVisible, onDissipated }: FogOfWarProps) {
    const [particles, setParticles] = useState<FogParticle[]>([]);

    // Generate random fog particles on mount
    useEffect(() => {
        const newParticles: FogParticle[] = [];
        for (let i = 0; i < 15; i++) {
            newParticles.push({
                id: i,
                x: Math.random() * 100,
                y: Math.random() * 100,
                size: 40 + Math.random() * 60,
                duration: 8 + Math.random() * 6,
                delay: Math.random() * 3,
            });
        }
        setParticles(newParticles);
    }, []);

    return (
        <motion.div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            initial={{ opacity: 1 }}
            animate={{ opacity: isVisible ? 1 : 0 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            onAnimationComplete={() => {
                if (!isVisible && onDissipated) {
                    onDissipated();
                }
            }}
        >
            {/* Base fog layer */}
            <div
                className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-800/70 to-transparent"
            />

            {/* Animated fog particles */}
            {particles.map((particle) => (
                <motion.div
                    key={particle.id}
                    className="absolute rounded-full"
                    style={{
                        left: `${particle.x}%`,
                        top: `${particle.y}%`,
                        width: particle.size,
                        height: particle.size,
                        background: 'radial-gradient(circle, rgba(148, 163, 184, 0.4) 0%, transparent 70%)',
                    }}
                    animate={{
                        x: [0, 30, -20, 10, 0],
                        y: [0, -15, 10, -5, 0],
                        scale: [1, 1.1, 0.9, 1.05, 1],
                        opacity: isVisible ? [0.3, 0.5, 0.3, 0.4, 0.3] : 0,
                    }}
                    transition={{
                        duration: particle.duration,
                        delay: particle.delay,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
            ))}

            {/* Mystical glow at center */}
            <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{
                    opacity: isVisible ? [0.2, 0.4, 0.2] : 0,
                }}
                transition={{ duration: 3, repeat: Infinity }}
            >
                <div
                    className="w-20 h-20 rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(129, 140, 248, 0.3) 0%, transparent 70%)',
                    }}
                />
            </motion.div>
        </motion.div>
    );
}

/**
 * GlobalFog — Full-screen fog for unexplored areas
 */
export function GlobalFog({
    revealedArea
}: {
    revealedArea: { x: number; y: number; radius: number }
}) {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* SVG mask for revealed area */}
            <svg className="absolute inset-0 w-full h-full">
                <defs>
                    <radialGradient id="fogGradient" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="white" stopOpacity="1" />
                        <stop offset="70%" stopColor="white" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </radialGradient>
                    <mask id="revealMask">
                        <rect width="100%" height="100%" fill="white" />
                        <circle
                            cx={revealedArea.x}
                            cy={revealedArea.y}
                            r={revealedArea.radius}
                            fill="url(#fogGradient)"
                        />
                    </mask>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    fill="rgba(15, 23, 42, 0.85)"
                    mask="url(#revealMask)"
                />
            </svg>
        </div>
    );
}
