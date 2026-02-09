'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MazeTile, MazeBlueprint } from './types';

export type GameState = 'LANDING' | 'GENERATING' | 'PLAYING' | 'TASK_DETAIL';

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
    mazeBlueprint?: MazeBlueprint;
    generatedAt: string;
}

const TASK_ICONS: Record<string, string> = {
    DOCUMENT_SCANNER: '📜',
    LETTER_WRITER: '✉️',
    CALL_SIMULATOR: '📞',
    HAWK_DOVE_DEBATE: '⚔️',
    COACH_CHAT: '💪',
    EXTERNAL_LINK: '✉️',
    FUTURE_SELF: '💬',
    CALCULATOR: '🧮',
};

const TASK_LABELS: Record<string, string> = {
    DOCUMENT_SCANNER: 'Scan Document',
    LETTER_WRITER: 'Generate Letter',
    CALL_SIMULATOR: 'Practice Call',
    HAWK_DOVE_DEBATE: 'View Debate',
    COACH_CHAT: 'Ask Coach',
    EXTERNAL_LINK: 'Generate Letter',
    FUTURE_SELF: 'Talk to Future You',
    CALCULATOR: 'Calculate',
};

interface GameCardProps {
    gameState: GameState;
    streamingNarrative: string;
    freedomPath: FreedomPath | null;
    activeTile: MazeTile | null;
    attachments?: File[];
    onGenerate: (whatIf?: string) => void;
    onNextTask: () => void;
    onStartTask: (tile: MazeTile) => void;
    onComplete: (tileId: string) => void;
    onBack: () => void;
    onAttachmentsChange?: (files: File[]) => void;
}

export function GameCard({
    gameState,
    streamingNarrative,
    freedomPath,
    activeTile,
    attachments = [],
    onGenerate,
    onNextTask,
    onStartTask,
    onComplete,
    onBack,
    onAttachmentsChange,
}: GameCardProps) {
    const [inputText, setInputText] = useState('');
    const narrativeEndRef = useRef<HTMLDivElement>(null);
    const attachFileRef = useRef<HTMLInputElement>(null);

    const handleAddAttachments = useCallback((files: FileList | null) => {
        if (!files || !onAttachmentsChange) return;
        const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        onAttachmentsChange([...attachments, ...newFiles]);
    }, [attachments, onAttachmentsChange]);

    const handleRemoveAttachment = useCallback((index: number) => {
        if (!onAttachmentsChange) return;
        onAttachmentsChange(attachments.filter((_, i) => i !== index));
    }, [attachments, onAttachmentsChange]);

    // Auto-scroll streaming narrative
    useEffect(() => {
        narrativeEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [streamingNarrative]);

    // Auto-trigger letter generation for EXTERNAL_LINK tasks (no user input needed)
    const autoTriggeredRef = useRef<string | null>(null);
    useEffect(() => {
        if (
            gameState === 'TASK_DETAIL' &&
            activeTile &&
            activeTile.requiredTask.type === 'EXTERNAL_LINK' &&
            autoTriggeredRef.current !== activeTile.milestoneId
        ) {
            autoTriggeredRef.current = activeTile.milestoneId;
            onStartTask(activeTile);
        }
        if (gameState !== 'TASK_DETAIL') {
            autoTriggeredRef.current = null;
        }
    }, [gameState, activeTile, onStartTask]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onGenerate(inputText || undefined);
    };

    return (
        <div className="w-full md:w-[440px] max-h-[650px] flex flex-col">
            <div className="bg-white/80 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl shadow-black/10 overflow-hidden flex flex-col max-h-[650px]">
                <AnimatePresence mode="wait">
                    {/* LANDING STATE */}
                    {gameState === 'LANDING' && (
                        <motion.div
                            key="landing"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="p-8"
                        >
                            <p className="text-gray-600 mb-5" style={{ fontSize: '20px' }}>
                                Type your question to get started
                            </p>
                            <form onSubmit={handleSubmit}>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        placeholder="What if I..."
                                        className="w-full px-5 py-4 pr-14 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition"
                                        style={{ fontSize: '20px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => attachFileRef.current?.click()}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-emerald-500 transition rounded-lg hover:bg-emerald-50"
                                        title="Attach screenshots"
                                    >
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                                        </svg>
                                    </button>
                                    <input
                                        ref={attachFileRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => handleAddAttachments(e.target.files)}
                                    />
                                </div>
                            </form>

                            {/* Attachment previews */}
                            {attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {attachments.map((file, i) => (
                                        <div key={i} className="relative group">
                                            <img
                                                src={URL.createObjectURL(file)}
                                                alt={file.name}
                                                className="w-16 h-16 object-cover rounded-lg border-2 border-emerald-300"
                                            />
                                            <button
                                                onClick={() => handleRemoveAttachment(i)}
                                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                                style={{ fontSize: '12px' }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    <span className="text-gray-400 self-center" style={{ fontSize: '14px' }}>
                                        {attachments.length} screenshot{attachments.length > 1 ? 's' : ''} attached
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center gap-3 my-5">
                                <div className="flex-1 h-px bg-gray-200" />
                                <span className="text-gray-400" style={{ fontSize: '16px' }}>or</span>
                                <div className="flex-1 h-px bg-gray-200" />
                            </div>
                            <button
                                onClick={() => onGenerate()}
                                className="w-full px-5 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20"
                                style={{ fontSize: '20px' }}
                            >
                                I'm feeling lucky
                            </button>
                        </motion.div>
                    )}

                    {/* GENERATING STATE */}
                    {gameState === 'GENERATING' && (
                        <motion.div
                            key="generating"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="p-8"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-emerald-600 font-medium" style={{ fontSize: '20px' }}>
                                    Gemini is building your path...
                                </span>
                            </div>
                            <div className="max-h-[50vh] overflow-y-auto text-gray-700 leading-relaxed" style={{ fontSize: '18px' }}>
                                <p className="whitespace-pre-wrap">
                                    {streamingNarrative}
                                    <span className="inline-block w-1.5 h-5 bg-emerald-500 ml-0.5 animate-pulse align-middle" />
                                </p>
                                <div ref={narrativeEndRef} />
                            </div>
                        </motion.div>
                    )}

                    {/* PLAYING STATE */}
                    {gameState === 'PLAYING' && freedomPath && (
                        <motion.div
                            key="playing"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col"
                        >
                            {/* Plan summary header */}
                            <div className="p-8 pb-4">
                                <h3 className="text-gray-900 font-bold mb-4 tracking-wide uppercase" style={{ fontSize: '16px' }}>
                                    Gemini's Life Plan
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-100/80 rounded-lg px-4 py-3">
                                        <p className="text-gray-400 text-xs uppercase tracking-wider">Debt-Free</p>
                                        <p className="text-gray-900 font-semibold" style={{ fontSize: '16px' }}>
                                            {freedomPath.optimalOutcome.debtFreeDate
                                                ? new Date(freedomPath.optimalOutcome.debtFreeDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                                : 'TBD'}
                                        </p>
                                    </div>
                                    <div className="bg-gray-100/80 rounded-lg px-4 py-3">
                                        <p className="text-gray-400 text-xs uppercase tracking-wider">Strategy</p>
                                        <p className="text-gray-900 font-semibold truncate" style={{ fontSize: '16px' }}>
                                            {freedomPath.optimalOutcome.strategyName || 'Custom'}
                                        </p>
                                    </div>
                                    <div className="bg-gray-100/80 rounded-lg px-4 py-3">
                                        <p className="text-gray-400 text-xs uppercase tracking-wider">Total Saved</p>
                                        <p className="text-emerald-600 font-semibold" style={{ fontSize: '16px' }}>
                                            ${(freedomPath.optimalOutcome.totalSaved || 0).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="bg-gray-100/80 rounded-lg px-4 py-3">
                                        <p className="text-gray-400 text-xs uppercase tracking-wider">Life Score</p>
                                        <p className="text-gray-900 font-semibold" style={{ fontSize: '16px' }}>
                                            {freedomPath.optimalOutcome.qualityOfLifeScore || 0}/10
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable narrative — 18px, broken into paragraphs */}
                            {streamingNarrative && (
                                <div className="px-8 pb-4 max-h-[30vh] overflow-y-auto space-y-3">
                                    {streamingNarrative
                                        .split(/\n\n+/)
                                        .flatMap(block => {
                                            const sentences = block.match(/[^.!?]+[.!?]+\s*/g) || [block];
                                            const chunks: string[] = [];
                                            let current = '';
                                            for (const s of sentences) {
                                                current += s;
                                                if ((current.match(/[.!?]/g) || []).length >= 2) {
                                                    chunks.push(current.trim());
                                                    current = '';
                                                }
                                            }
                                            if (current.trim()) chunks.push(current.trim());
                                            return chunks;
                                        })
                                        .filter(p => p.length > 0)
                                        .map((paragraph, i) => (
                                            <p key={i} className="text-gray-600 leading-relaxed" style={{ fontSize: '18px' }}>
                                                {paragraph}
                                            </p>
                                        ))
                                    }
                                </div>
                            )}

                            {/* Next Task button */}
                            <div className="p-8 pt-3 border-t border-gray-200/50">
                                <button
                                    onClick={onNextTask}
                                    className="w-full px-5 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                                    style={{ fontSize: '20px' }}
                                >
                                    Next Task
                                    <span>→</span>
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* TASK_DETAIL STATE */}
                    {gameState === 'TASK_DETAIL' && activeTile && (
                        <motion.div
                            key="task-detail"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col"
                        >
                            {/* Back button */}
                            <button
                                onClick={onBack}
                                className="px-8 pt-6 pb-2 text-gray-400 hover:text-gray-700 transition flex items-center gap-1 self-start"
                                style={{ fontSize: '16px' }}
                            >
                                <span>←</span> Back to Plan
                            </button>

                            {/* Task info */}
                            <div className="px-8 pb-4">
                                <div className="flex items-start gap-3 mb-4">
                                    <span className="text-3xl mt-0.5">
                                        {TASK_ICONS[activeTile.requiredTask.type] || '🔷'}
                                    </span>
                                    <h3 className="text-gray-900 font-bold leading-snug" style={{ fontSize: '20px' }}>
                                        {activeTile.requiredTask.instruction}
                                    </h3>
                                </div>

                                {/* Gemini's reasoning */}
                                <div className="bg-indigo-50 border border-indigo-200/50 rounded-xl px-4 py-3">
                                    <p className="text-indigo-700 leading-relaxed" style={{ fontSize: '16px' }}>
                                        <span className="font-semibold text-indigo-800">Why this step: </span>
                                        {activeTile.requiredTask.reason}
                                    </p>
                                </div>
                            </div>

                            {/* Action buttons — hidden for EXTERNAL_LINK (auto-generates letter) */}
                            <div className="p-8 pt-3 border-t border-gray-200/50">
                                {activeTile.requiredTask.type === 'EXTERNAL_LINK' ? (
                                    <div className="flex flex-col items-center gap-3 py-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-gray-600 font-medium" style={{ fontSize: '18px' }}>
                                                Generating draft letter...
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => onComplete(activeTile.milestoneId)}
                                            className="w-full mt-2 px-5 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20"
                                            style={{ fontSize: '20px' }}
                                        >
                                            Complete →
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => onStartTask(activeTile)}
                                            className="flex-1 px-5 py-4 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all border border-gray-200"
                                            style={{ fontSize: '20px' }}
                                        >
                                            {TASK_LABELS[activeTile.requiredTask.type] || 'Start Task'}
                                        </button>
                                        <button
                                            onClick={() => onComplete(activeTile.milestoneId)}
                                            className="flex-1 px-5 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20"
                                            style={{ fontSize: '20px' }}
                                        >
                                            Complete →
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
