'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { MazeTile } from './types';

interface MilestonePanelProps {
    tile: MazeTile | null;
    isOpen: boolean;
    onClose: () => void;
    onStartTask: (tile: MazeTile) => void;
    onComplete: (tileId: string) => void;
}

const TASK_LABELS: Record<string, string> = {
    DOCUMENT_SCANNER: '📜 Scan Document',
    LETTER_WRITER: '✉️ Generate Letter',
    CALL_SIMULATOR: '📞 Practice Call',
    HAWK_DOVE_DEBATE: '⚔️ View Debate',
    COACH_CHAT: '💪 Ask Coach',
    EXTERNAL_LINK: '🔗 Open Link',
    FUTURE_SELF: '💬 Talk to Future You',
    CALCULATOR: '🧮 Calculate',
};

export function MilestonePanel({ tile, isOpen, onClose, onStartTask, onComplete }: MilestonePanelProps) {
    if (!tile) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 bg-black/50 z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.div
                        className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] overflow-y-auto"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    >
                        <div className="bg-slate-900 border-t border-white/10 rounded-t-3xl px-6 py-8 max-w-2xl mx-auto">
                            {/* Handle */}
                            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />

                            {/* Task instruction */}
                            <h3 className="text-xl font-bold text-white mb-2">
                                {tile.requiredTask.instruction}
                            </h3>

                            {/* Gemini's reasoning */}
                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 mb-6">
                                <p className="text-sm text-indigo-300">
                                    <span className="font-semibold">Why this step: </span>
                                    {tile.requiredTask.reason}
                                </p>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => onStartTask(tile)}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all"
                                >
                                    {TASK_LABELS[tile.requiredTask.type] || 'Start Task'}
                                </button>
                                <button
                                    onClick={() => onComplete(tile.milestoneId)}
                                    className="px-6 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-all border border-white/20"
                                >
                                    Complete & Advance →
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
