'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

type Stage = 'STAGE_0_FREEDOM' | 'STAGE_1_SIMULATOR' | 'STAGE_2_COACH' | 'STAGE_3_AUDITOR' | 'STAGE_4_OPTIMIZER';

const stages: { id: Stage; label: string; icon: string; path: string }[] = [
    { id: 'STAGE_0_FREEDOM', label: 'Freedom Path', icon: '🗽', path: '/freedom' },
    { id: 'STAGE_1_SIMULATOR', label: 'Simulator', icon: '🔮', path: '/simulator' },
    { id: 'STAGE_2_COACH', label: 'Coach', icon: '💪', path: '/coach' },
    { id: 'STAGE_3_AUDITOR', label: 'Magic Mirror', icon: '🪞', path: '/auditor' },
    { id: 'STAGE_4_OPTIMIZER', label: 'Optimizer', icon: '🗺️', path: '/optimizer' },
];

interface StageSwitcherProps {
    currentStage: Stage;
}

export function StageSwitcher({ currentStage }: StageSwitcherProps) {
    const [isOpen, setIsOpen] = useState(false);

    const currentStageInfo = stages.find(s => s.id === currentStage) || stages[0];

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <motion.div
                className="relative"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}
            >
                {/* Expanded stage list */}
                <motion.div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3"
                    initial={false}
                    animate={{
                        opacity: isOpen ? 1 : 0,
                        scale: isOpen ? 1 : 0.9,
                        y: isOpen ? 0 : 10
                    }}
                    style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
                >
                    <div className="bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 p-2 shadow-2xl">
                        <div className="flex gap-2">
                            <Link
                                href="/"
                                onClick={() => setIsOpen(false)}
                            >
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="px-4 py-3 rounded-xl flex items-center gap-2 transition-colors hover:bg-white/5 text-gray-300 border-r border-white/10"
                                >
                                    <span className="text-xl">🏠</span>
                                    <span className="font-medium whitespace-nowrap">Home</span>
                                </motion.div>
                            </Link>
                            {stages.map((stage) => (
                                <Link
                                    key={stage.id}
                                    href={stage.path}
                                    onClick={() => setIsOpen(false)}
                                >
                                    <motion.div
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className={`
                      px-4 py-3 rounded-xl flex items-center gap-2 transition-colors
                      ${stage.id === currentStage
                                                ? 'bg-indigo-600 text-white'
                                                : 'hover:bg-white/5 text-gray-300'
                                            }
                    `}
                                    >
                                        <span className="text-xl">{stage.icon}</span>
                                        <span className="font-medium whitespace-nowrap">{stage.label}</span>
                                    </motion.div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Main pill button */}
                <motion.button
                    onClick={() => setIsOpen(!isOpen)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="
            flex items-center gap-3 px-6 py-3
            bg-gradient-to-r from-indigo-600 to-purple-600
            rounded-full shadow-lg shadow-indigo-500/30
            border border-white/10
          "
                >
                    <span className="text-xl">{currentStageInfo.icon}</span>
                    <span className="font-semibold text-white">{currentStageInfo.label}</span>
                    <motion.svg
                        className="w-4 h-4 text-white/70"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        animate={{ rotate: isOpen ? 180 : 0 }}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </motion.svg>

                    {/* Demo mode badge */}
                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30">
                        DEMO
                    </span>
                </motion.button>
            </motion.div>
        </div>
    );
}
