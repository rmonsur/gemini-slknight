'use client';

import { motion, AnimatePresence } from 'framer-motion';

type ThemeMood = 'OPTIMISTIC' | 'NEUTRAL' | 'CRISIS' | 'CYBERPUNK';

const moodConfig: Record<ThemeMood, { label: string; color: string; bg: string; icon: string }> = {
    OPTIMISTIC: { label: 'Optimistic', color: 'text-emerald-300', bg: 'bg-emerald-500/20 border-emerald-500/30', icon: '☀️' },
    NEUTRAL: { label: 'Neutral', color: 'text-blue-300', bg: 'bg-blue-500/20 border-blue-500/30', icon: '⚖️' },
    CRISIS: { label: 'Crisis', color: 'text-red-300', bg: 'bg-red-500/20 border-red-500/30', icon: '⚠️' },
    CYBERPUNK: { label: 'Cyberpunk', color: 'text-violet-300', bg: 'bg-violet-500/20 border-violet-500/30', icon: '⚡' },
};

interface AIMoodBadgeProps {
    mood: ThemeMood;
}

export function AIMoodBadge({ mood }: AIMoodBadgeProps) {
    const config = moodConfig[mood] || moodConfig.NEUTRAL;

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={mood}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${config.bg} ${config.color}`}
            >
                <span>{config.icon}</span>
                <span>AI Mood:</span>
                <span className="font-semibold">{config.label}</span>
            </motion.div>
        </AnimatePresence>
    );
}
