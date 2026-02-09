// @ts-nocheck - Complex SSE types
'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FutureSelfChat from '@/components/freedom/FutureSelfChat';
import HawkDoveDebate from '@/components/freedom/HawkDoveDebate';
import OrchestratorPanel from '@/components/orchestrator/OrchestratorPanel';
import { GameCard, type MazeTile, type MazeBlueprint, type GameState } from '@/components/maze';
import { AgentActivityFeed } from '@/components/feed/AgentActivityFeed';

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

export default function LandingPage() {
    const [gameState, setGameState] = useState<GameState>('LANDING');
    const [completedTileIds, setCompletedTileIds] = useState<Set<string>>(new Set());

    const [streamingNarrative, setStreamingNarrative] = useState('');
    const [freedomPath, setFreedomPath] = useState<FreedomPath | null>(null);
    const [activeTile, setActiveTile] = useState<MazeTile | null>(null);

    const [showFutureSelfChat, setShowFutureSelfChat] = useState(false);
    const [activeDebate, setActiveDebate] = useState<DecisionPoint | null>(null);
    const [showOrchestrator, setShowOrchestrator] = useState(false);

    // Agent modals
    const [letterModal, setLetterModal] = useState<{ open: boolean; instruction: string; streaming: string }>({ open: false, instruction: '', streaming: '' });
    const [calcModal, setCalcModal] = useState<{ open: boolean; instruction: string; result: string; loading: boolean }>({ open: false, instruction: '', result: '', loading: false });
    const [callScriptModal, setCallScriptModal] = useState<{ open: boolean; instruction: string; script: Record<string, unknown> | null; loading: boolean }>({ open: false, instruction: '', script: null, loading: false });
    // Attachments for main chat
    const [attachments, setAttachments] = useState<File[]>([]);
    const attachInputRef = useRef<HTMLInputElement>(null);
    const [scanModal, setScanModal] = useState<{
        open: boolean;
        mode: 'choose' | 'uploading' | 'extracting' | 'grants' | 'done' | 'qr' | 'error';
        sessionId: string;
        uploadUrl: string;
        extraction: Record<string, unknown> | null;
        grants: { count: number; totalValue: number; offers: unknown[] } | null;
        statusText: string;
        confidence: number;
        pathRecalculated: boolean;
    }>({ open: false, mode: 'choose', sessionId: '', uploadUrl: '', extraction: null, grants: null, statusText: '', confidence: 0, pathRecalculated: false });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleGenerate = useCallback(async (whatIf?: string) => {
        setGameState('GENERATING');
        setStreamingNarrative('');
        setFreedomPath(null);
        setCompletedTileIds(new Set());

        // If screenshots are attached, process them through vision pipeline first
        if (attachments.length > 0) {
            setStreamingNarrative('Analyzing your screenshots with Gemini Vision...\n\n');
            for (const file of attachments) {
                try {
                    const base64 = await new Promise<string>((resolve) => {
                        const fr = new FileReader();
                        fr.onloadend = () => resolve((fr.result as string).split(',')[1]);
                        fr.readAsDataURL(file);
                    });
                    const visionRes = await fetch(`${API_BASE}/api/simulator/vision-extract`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: base64, mimeType: file.type || 'image/png' }),
                    });
                    const vReader = visionRes.body?.getReader();
                    const vDecoder = new TextDecoder();
                    if (vReader) {
                        while (true) {
                            const { done, value } = await vReader.read();
                            if (done) break;
                            const chunk = vDecoder.decode(value, { stream: true });
                            for (const line of chunk.split('\n')) {
                                if (!line.startsWith('data: ')) continue;
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    if (data.type === 'status') {
                                        setStreamingNarrative(prev => prev + data.text + '\n');
                                    } else if (data.type === 'extraction') {
                                        const ext = data.data.extractedData;
                                        const fields = Object.entries(ext).filter(([, v]) => v !== null);
                                        setStreamingNarrative(prev => prev + `Found ${fields.length} data points from your screenshot.\n`);
                                    } else if (data.type === 'grants') {
                                        setStreamingNarrative(prev => prev + `Matched ${data.data.count} grants worth $${data.data.totalValue.toLocaleString()}.\n\n`);
                                    } else if (data.type === 'freedomPath') {
                                        setFreedomPath(data.data);
                                    }
                                } catch { /* skip */ }
                            }
                        }
                    }
                } catch {
                    setStreamingNarrative(prev => prev + 'Could not process one screenshot. Continuing...\n');
                }
            }
            setAttachments([]);
        }

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
                            console.log('[Frontend] Received freedomPath:', data.data);
                            setFreedomPath(data.data);
                        }
                    } catch (e) { /* skip */ }
                }
            }
        } catch (error) {
            console.error('Error generating Freedom Path:', error);
        } finally {
            setGameState(prev => prev === 'GENERATING' ? 'PLAYING' : prev);
        }
    }, [attachments]);

    const blueprint = freedomPath?.mazeBlueprint;

    const nextTask = useMemo(() => {
        if (!blueprint) return null;
        const todayTile = blueprint.tiles.find(t => t.tileType === 'TODAY');
        const todayId = todayTile?.milestoneId;
        for (const tile of blueprint.tiles) {
            if (tile.milestoneId === todayId) continue;
            if (!completedTileIds.has(tile.milestoneId)) return tile;
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
        setGameState('PLAYING');
        setActiveTile(null);
    }, []);

    const handleBack = useCallback(() => {
        setGameState('PLAYING');
        setActiveTile(null);
    }, []);

    // --- Agent trigger handlers ---

    const handleStartCalculator = useCallback(async (instruction: string) => {
        setCalcModal({ open: true, instruction, result: '', loading: true });
        try {
            const res = await fetch(`${API_BASE}/api/coach/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `Calculate this for me: ${instruction}` }),
            });
            const data = await res.json();
            setCalcModal(prev => ({ ...prev, result: data.message || 'Calculation complete.', loading: false }));
        } catch {
            setCalcModal(prev => ({ ...prev, result: 'Error calculating. Please try again.', loading: false }));
        }
    }, []);

    const handleStartLetter = useCallback(async (instruction: string) => {
        setLetterModal({ open: true, instruction, streaming: '' });
        try {
            const res = await fetch(`${API_BASE}/api/simulator/generate-letter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ letterType: 'SAVE_ENROLLMENT', instruction }),
            });
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) return;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === 'letter' || data.type === 'text' || data.type === 'narrative') {
                            setLetterModal(prev => ({ ...prev, streaming: prev.streaming + (data.text || data.letter || '') }));
                        } else if (data.text) {
                            setLetterModal(prev => ({ ...prev, streaming: prev.streaming + data.text }));
                        }
                    } catch { /* skip */ }
                }
            }
        } catch {
            setLetterModal(prev => ({ ...prev, streaming: 'Error generating letter. Please try again.' }));
        }
    }, []);

    const handleStartScan = useCallback(() => {
        setScanModal({ open: true, mode: 'choose', sessionId: '', uploadUrl: '', extraction: null, grants: null, statusText: '', confidence: 0, pathRecalculated: false });
    }, []);

    const handleStartCallScript = useCallback(async (instruction: string) => {
        setCallScriptModal({ open: true, instruction, script: null, loading: true });
        try {
            const res = await fetch(`${API_BASE}/api/simulator/call-script`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ servicer: 'Nelnet', objective: instruction }),
            });
            const data = await res.json();
            setCallScriptModal(prev => ({ ...prev, script: data.script || null, loading: false }));
        } catch {
            setCallScriptModal(prev => ({ ...prev, script: null, loading: false }));
        }
    }, []);

    const handleScanQR = useCallback(async () => {
        setScanModal(prev => ({ ...prev, mode: 'qr', statusText: 'Creating upload session...' }));
        try {
            const res = await fetch(`${API_BASE}/api/scan/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            const sessionId = data.sessionId || data.data?.sessionId || '';
            const uploadUrl = `${window.location.origin}/mobile-upload/${sessionId}`;
            setScanModal(prev => ({ ...prev, sessionId, uploadUrl, statusText: '' }));
        } catch {
            setScanModal(prev => ({ ...prev, mode: 'error', statusText: 'Failed to create session.' }));
        }
    }, []);

    const handleVisionUpload = useCallback(async (file: File) => {
        setScanModal(prev => ({ ...prev, mode: 'extracting', statusText: 'Reading your document...', extraction: null, grants: null }));

        // Convert file to base64
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]); // strip data:image/...;base64,
            };
            reader.readAsDataURL(file);
        });

        try {
            const response = await fetch(`${API_BASE}/api/simulator/vision-extract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64, mimeType: file.type || 'image/png' }),
            });

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

                        if (data.type === 'status') {
                            setScanModal(prev => ({ ...prev, statusText: data.text }));
                        } else if (data.type === 'extraction') {
                            setScanModal(prev => ({
                                ...prev,
                                mode: 'extracting',
                                extraction: data.data.extractedData,
                                confidence: data.data.confidence,
                                statusText: 'Finding matching grants...',
                            }));
                        } else if (data.type === 'grants') {
                            setScanModal(prev => ({
                                ...prev,
                                mode: 'grants',
                                grants: data.data,
                                statusText: 'Recalculating your path...',
                            }));
                        } else if (data.type === 'freedomPath') {
                            setFreedomPath(data.data);
                            setScanModal(prev => ({ ...prev, pathRecalculated: true }));
                        } else if (data.type === 'done') {
                            setScanModal(prev => ({ ...prev, mode: 'done', statusText: '' }));
                        } else if (data.type === 'error') {
                            setScanModal(prev => ({ ...prev, mode: 'error', statusText: data.message }));
                        }
                    } catch { /* skip */ }
                }
            }
        } catch {
            setScanModal(prev => ({ ...prev, mode: 'error', statusText: 'Failed to analyze document. Try a clearer screenshot.' }));
        }
    }, []);

    const handleStartTask = useCallback((tile: MazeTile) => {
        const taskType = tile.requiredTask.type;
        if (taskType === 'FUTURE_SELF') {
            setShowFutureSelfChat(true);
        } else if (taskType === 'HAWK_DOVE_DEBATE') {
            setActiveDebate({
                question: tile.requiredTask.instruction,
                hawkPosition: 'Aggressive approach: prioritize speed of repayment',
                dovePosition: 'Conservative approach: prioritize quality of life',
            });
        } else if (taskType === 'CALCULATOR') {
            handleStartCalculator(tile.requiredTask.instruction);
        } else if (taskType === 'LETTER_WRITER') {
            // Auto-generate — no human input needed
            handleStartLetter(tile.requiredTask.instruction);
        } else if (taskType === 'DOCUMENT_SCANNER') {
            handleStartScan();
        } else if (taskType === 'CALL_SIMULATOR') {
            // Auto-draft talking points via drill sergeant
            handleStartCallScript(tile.requiredTask.instruction);
        } else if (taskType === 'COACH_CHAT') {
            handleStartCalculator(tile.requiredTask.instruction);
        } else if (taskType === 'EXTERNAL_LINK') {
            // Auto-generate a letter instead of opening a link
            handleStartLetter(tile.requiredTask.instruction);
        } else {
            console.log('Starting task:', tile.milestoneId, taskType);
        }
    }, [handleStartCalculator, handleStartLetter, handleStartScan, handleStartCallScript]);

    const debtFreeYear = freedomPath?.optimalOutcome.debtFreeDate?.split('-')[0] || '2030';

    return (
        <div className="min-h-screen relative">
            <div className="relative z-10 min-h-screen">
                {/* Top: Headline — hidden on mobile */}
                <div className="hidden md:block max-w-7xl mx-auto px-6 pt-20">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7 }}
                        className="max-w-lg mb-8"
                    >
                        <h1 className="text-5xl md:text-7xl font-black text-white mb-4 drop-shadow-lg leading-tight">
                            Crush Student Debt. Find Financial Freedom
                        </h1>
                        <p className="text-lg md:text-xl text-white/90 font-medium drop-shadow-md">
                            SLKnight is a AI orchestrator that takes control of your student debt and helps you to find financial freedom.
                        </p>
                    </motion.div>
                </div>

                {/* Two-column layout: Card left, Timeline right — stacks on mobile */}
                <div className="max-w-7xl mx-auto px-4 md:px-6 pb-16 pt-4 md:pt-0">
                    <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-8">
                        {/* Left column: GameCard (sticky on desktop, full-width on mobile) */}
                        <div className="w-full md:w-[440px] md:flex-shrink-0 md:sticky md:top-6">
                            <GameCard
                                gameState={gameState}
                                streamingNarrative={streamingNarrative}
                                freedomPath={freedomPath}
                                activeTile={activeTile}
                                attachments={attachments}
                                onGenerate={handleGenerate}
                                onNextTask={handleNextTask}
                                onStartTask={handleStartTask}
                                onComplete={handleComplete}
                                onBack={handleBack}
                                onAttachmentsChange={setAttachments}
                            />
                        </div>

                        {/* Right column: Agent Activity Feed */}
                        <div className="flex-1 min-w-0 min-h-[400px] md:min-h-[600px] bg-white rounded-2xl shadow-lg">
                            <AgentActivityFeed idle={gameState === 'LANDING'} />
                        </div>
                    </div>
                </div>
            </div>

            {/* === Agent Modals === */}

            {/* Calculator Modal */}
            <AnimatePresence>
                {calcModal.open && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="absolute inset-0 bg-black/40" onClick={() => setCalcModal(prev => ({ ...prev, open: false }))} />
                        <motion.div
                            className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8"
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                        >
                            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2" style={{ fontSize: '18px' }}>
                                <span>🧮</span> Calculator
                            </h3>
                            <p className="text-gray-600 mb-4" style={{ fontSize: '16px' }}>{calcModal.instruction}</p>
                            {calcModal.loading ? (
                                <div className="flex items-center gap-3 py-4">
                                    <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-gray-500" style={{ fontSize: '16px' }}>Calculating...</span>
                                </div>
                            ) : (
                                <div className="bg-gray-50 rounded-xl p-4 text-gray-800 leading-relaxed whitespace-pre-wrap" style={{ fontSize: '16px' }}>
                                    {calcModal.result}
                                </div>
                            )}
                            <button
                                onClick={() => setCalcModal(prev => ({ ...prev, open: false }))}
                                className="mt-4 w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition"
                                style={{ fontSize: '16px' }}
                            >
                                Close
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Letter Modal */}
            <AnimatePresence>
                {letterModal.open && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="absolute inset-0 bg-black/40" onClick={() => setLetterModal(prev => ({ ...prev, open: false }))} />
                        <motion.div
                            className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8 max-h-[80vh] overflow-y-auto"
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                        >
                            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2" style={{ fontSize: '18px' }}>
                                <span>✉️</span> Auto-Generated Letter
                            </h3>
                            <p className="text-gray-500 mb-4" style={{ fontSize: '16px' }}>{letterModal.instruction}</p>
                            <div className="bg-gray-50 rounded-xl p-4 text-gray-800 leading-relaxed whitespace-pre-wrap font-mono" style={{ fontSize: '16px' }}>
                                {letterModal.streaming || (
                                    <div className="flex items-center gap-3">
                                        <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-gray-500" style={{ fontSize: '16px' }}>AI is writing your letter...</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(letterModal.streaming);
                                    }}
                                    className="flex-1 py-3 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-400 transition"
                                    style={{ fontSize: '16px' }}
                                >
                                    Copy to Clipboard
                                </button>
                                <button
                                    onClick={() => handleStartLetter(letterModal.instruction)}
                                    className="py-3 px-4 bg-amber-50 text-amber-700 font-medium rounded-xl hover:bg-amber-100 transition border border-amber-200"
                                    style={{ fontSize: '16px' }}
                                >
                                    Rewrite
                                </button>
                                <button
                                    onClick={() => setLetterModal(prev => ({ ...prev, open: false }))}
                                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition"
                                    style={{ fontSize: '16px' }}
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Call Script Modal — Auto-generated talking points */}
            <AnimatePresence>
                {callScriptModal.open && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="absolute inset-0 bg-black/40" onClick={() => setCallScriptModal(prev => ({ ...prev, open: false }))} />
                        <motion.div
                            className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8 max-h-[80vh] overflow-y-auto"
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                        >
                            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2" style={{ fontSize: '18px' }}>
                                <span>📞</span> Call Talking Points
                            </h3>
                            <p className="text-gray-500 mb-4" style={{ fontSize: '16px' }}>{callScriptModal.instruction}</p>

                            {callScriptModal.loading ? (
                                <div className="flex items-center gap-3 py-8 justify-center">
                                    <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-gray-500" style={{ fontSize: '16px' }}>Drill Sergeant is drafting your script...</span>
                                </div>
                            ) : callScriptModal.script ? (
                                <div className="space-y-4">
                                    {/* Opening */}
                                    {callScriptModal.script.openingStatement && (
                                        <div className="bg-emerald-50 rounded-xl p-4">
                                            <p className="text-emerald-700 font-semibold mb-1" style={{ fontSize: '14px' }}>Opening Statement</p>
                                            <p className="text-gray-800" style={{ fontSize: '16px' }}>"{callScriptModal.script.openingStatement}"</p>
                                        </div>
                                    )}

                                    {/* Phone + Time */}
                                    <div className="flex gap-3">
                                        {callScriptModal.script.servicerPhone && (
                                            <div className="flex-1 bg-gray-50 rounded-lg p-3">
                                                <p className="text-gray-400 text-xs uppercase">Phone</p>
                                                <p className="text-gray-900 font-semibold" style={{ fontSize: '16px' }}>{callScriptModal.script.servicerPhone}</p>
                                            </div>
                                        )}
                                        {callScriptModal.script.estimatedCallTime && (
                                            <div className="flex-1 bg-gray-50 rounded-lg p-3">
                                                <p className="text-gray-400 text-xs uppercase">Est. Time</p>
                                                <p className="text-gray-900 font-semibold" style={{ fontSize: '16px' }}>{callScriptModal.script.estimatedCallTime}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Talking Points */}
                                    {callScriptModal.script.talkingPoints && Array.isArray(callScriptModal.script.talkingPoints) && (
                                        <div className="space-y-3">
                                            <p className="text-gray-600 font-semibold" style={{ fontSize: '14px' }}>Talking Points</p>
                                            {callScriptModal.script.talkingPoints.map((tp: Record<string, string>, i: number) => (
                                                <div key={i} className="bg-gray-50 rounded-xl p-4">
                                                    <p className="text-gray-900 font-semibold mb-1" style={{ fontSize: '16px' }}>{tp.point}</p>
                                                    <p className="text-gray-700 mb-2" style={{ fontSize: '15px' }}>Say: "{tp.script}"</p>
                                                    {tp.anticipatedResponse && (
                                                        <p className="text-gray-500 italic" style={{ fontSize: '14px' }}>They'll say: {tp.anticipatedResponse}</p>
                                                    )}
                                                    {tp.rebuttal && (
                                                        <p className="text-emerald-700 mt-1" style={{ fontSize: '14px' }}>Rebuttal: {tp.rebuttal}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Key Phrases */}
                                    {callScriptModal.script.keyPhrases && Array.isArray(callScriptModal.script.keyPhrases) && (
                                        <div>
                                            <p className="text-gray-600 font-semibold mb-2" style={{ fontSize: '14px' }}>Key Phrases to Use</p>
                                            <div className="flex flex-wrap gap-2">
                                                {callScriptModal.script.keyPhrases.map((phrase: string, i: number) => (
                                                    <span key={i} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full" style={{ fontSize: '14px' }}>
                                                        {phrase}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Closing */}
                                    {callScriptModal.script.closingStatement && (
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <p className="text-gray-400 text-xs uppercase mb-1">Closing Statement</p>
                                            <p className="text-gray-800" style={{ fontSize: '16px' }}>"{callScriptModal.script.closingStatement}"</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-red-500" style={{ fontSize: '16px' }}>Failed to generate script. Try again.</p>
                            )}

                            <button
                                onClick={() => setCallScriptModal(prev => ({ ...prev, open: false }))}
                                className="mt-4 w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition"
                                style={{ fontSize: '16px' }}
                            >
                                Close
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Scan / Vision Extract Modal — Dual Mode: Drag-Drop + QR */}
            <AnimatePresence>
                {scanModal.open && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="absolute inset-0 bg-black/40" onClick={() => setScanModal(prev => ({ ...prev, open: false }))} />
                        <motion.div
                            className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8 max-h-[90vh] overflow-y-auto"
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                        >
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontSize: '18px' }}>
                                <span>📄</span> Scan Loan Document
                            </h3>

                            {/* === CHOOSE MODE === */}
                            {scanModal.mode === 'choose' && (
                                <>
                                    {/* Drag and Drop Zone */}
                                    <div
                                        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-all"
                                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-emerald-400', 'bg-emerald-50/50'); }}
                                        onDragLeave={(e) => { e.currentTarget.classList.remove('border-emerald-400', 'bg-emerald-50/50'); }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.classList.remove('border-emerald-400', 'bg-emerald-50/50');
                                            const file = e.dataTransfer.files[0];
                                            if (file && file.type.startsWith('image/')) handleVisionUpload(file);
                                        }}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <div className="text-4xl mb-3">📸</div>
                                        <p className="text-gray-800 font-semibold mb-1" style={{ fontSize: '16px' }}>
                                            Drop a screenshot here
                                        </p>
                                        <p className="text-gray-500" style={{ fontSize: '14px' }}>
                                            Screenshot your loan balance from Navient, Nelnet, or any servicer dashboard
                                        </p>
                                        <button
                                            className="mt-4 px-6 py-2.5 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-400 transition"
                                            style={{ fontSize: '16px' }}
                                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                        >
                                            Choose File
                                        </button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleVisionUpload(file);
                                            }}
                                        />
                                    </div>

                                    {/* Divider */}
                                    <div className="flex items-center gap-3 my-5">
                                        <div className="flex-1 h-px bg-gray-200" />
                                        <span className="text-gray-400" style={{ fontSize: '14px' }}>or upload from your phone</span>
                                        <div className="flex-1 h-px bg-gray-200" />
                                    </div>

                                    {/* QR Code option */}
                                    <button
                                        onClick={handleScanQR}
                                        className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition flex items-center justify-center gap-2"
                                        style={{ fontSize: '16px' }}
                                    >
                                        <span>📱</span> Generate QR Code for Mobile Upload
                                    </button>
                                </>
                            )}

                            {/* === QR MODE === */}
                            {scanModal.mode === 'qr' && (
                                <div className="text-center">
                                    {scanModal.uploadUrl ? (
                                        <>
                                            <p className="text-gray-600 mb-4" style={{ fontSize: '16px' }}>
                                                Scan with your phone to upload a photo of your loan statement.
                                            </p>
                                            <div className="flex justify-center mb-4">
                                                <img
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(scanModal.uploadUrl)}`}
                                                    alt="QR Code"
                                                    className="w-48 h-48 rounded-xl border border-gray-200"
                                                />
                                            </div>
                                            <a href={scanModal.uploadUrl} target="_blank" rel="noopener noreferrer"
                                                className="text-emerald-600 underline hover:text-emerald-500 break-all" style={{ fontSize: '14px' }}>
                                                {scanModal.uploadUrl}
                                            </a>
                                            <button
                                                onClick={() => setScanModal(prev => ({ ...prev, mode: 'choose' }))}
                                                className="mt-4 text-gray-500 hover:text-gray-700 transition block mx-auto"
                                                style={{ fontSize: '14px' }}
                                            >
                                                ← Back to screenshot upload
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex items-center justify-center gap-3 py-8">
                                            <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-gray-500" style={{ fontSize: '16px' }}>Creating upload session...</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* === EXTRACTING / GRANTS / DONE === */}
                            {(scanModal.mode === 'extracting' || scanModal.mode === 'grants' || scanModal.mode === 'done') && (
                                <div className="space-y-4">
                                    {/* Status text */}
                                    {scanModal.statusText && (
                                        <div className="flex items-center gap-3">
                                            <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                            <span className="text-gray-600" style={{ fontSize: '16px' }}>{scanModal.statusText}</span>
                                        </div>
                                    )}

                                    {/* Extracted fields */}
                                    {scanModal.extraction && (
                                        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-emerald-500 font-semibold" style={{ fontSize: '16px' }}>
                                                    Gemini Vision Extraction
                                                </span>
                                                {scanModal.confidence > 0 && (
                                                    <span className="text-gray-400" style={{ fontSize: '13px' }}>
                                                        ({Math.round(scanModal.confidence * 100)}% confidence)
                                                    </span>
                                                )}
                                            </div>
                                            {Object.entries(scanModal.extraction)
                                                .filter(([, v]) => v !== null)
                                                .map(([key, value]) => (
                                                    <div key={key} className="flex justify-between items-center">
                                                        <span className="text-gray-500 capitalize" style={{ fontSize: '14px' }}>
                                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                                        </span>
                                                        <span className="text-gray-900 font-medium" style={{ fontSize: '16px' }}>
                                                            {typeof value === 'number' && key.includes('alance')
                                                                ? `$${value.toLocaleString()}`
                                                                : typeof value === 'number' && key.includes('ate') && value < 1
                                                                    ? `${(value * 100).toFixed(2)}%`
                                                                    : typeof value === 'number' && key.includes('ayment')
                                                                        ? `$${value.toLocaleString()}`
                                                                        : String(value)}
                                                        </span>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    )}

                                    {/* Matched grants */}
                                    {scanModal.grants && (
                                        <div className="bg-emerald-50 rounded-xl p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-emerald-700 font-semibold" style={{ fontSize: '16px' }}>
                                                    🎯 {scanModal.grants.count} Grants Matched
                                                </span>
                                                <span className="text-emerald-600 font-bold" style={{ fontSize: '16px' }}>
                                                    ${scanModal.grants.totalValue.toLocaleString()} available
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Done state */}
                                    {scanModal.mode === 'done' && (
                                        <div className="bg-emerald-500 text-white rounded-xl p-4 text-center">
                                            <p className="font-semibold" style={{ fontSize: '16px' }}>
                                                ✅ Analysis Complete{scanModal.pathRecalculated ? ' — Path Recalculated!' : ''}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* === ERROR === */}
                            {scanModal.mode === 'error' && (
                                <div className="text-center py-4">
                                    <p className="text-red-500" style={{ fontSize: '16px' }}>{scanModal.statusText || 'Something went wrong.'}</p>
                                    <button
                                        onClick={() => setScanModal(prev => ({ ...prev, mode: 'choose' }))}
                                        className="mt-3 text-emerald-600 hover:text-emerald-500 font-medium"
                                        style={{ fontSize: '16px' }}
                                    >
                                        Try Again
                                    </button>
                                </div>
                            )}

                            {/* Close button */}
                            <button
                                onClick={() => setScanModal(prev => ({ ...prev, open: false }))}
                                className="mt-6 w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition"
                                style={{ fontSize: '16px' }}
                            >
                                {scanModal.mode === 'done' ? 'Continue' : 'Close'}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Existing modals: Future Self + Hawk/Dove */}
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

            {/* Orchestrator Panel */}
            <OrchestratorPanel
                isOpen={showOrchestrator}
                onClose={() => setShowOrchestrator(false)}
            />

            {/* Orchestrator Toggle Button — fixed bottom-left */}
            {/* Orchestrator Toggle Button — fixed top-right to avoid overlap */}
            <button
                onClick={() => setShowOrchestrator(true)}
                className="fixed top-24 right-6 z-40 px-4 py-2.5 bg-slate-900/90 backdrop-blur-sm border border-white/10 text-white/80 rounded-xl hover:bg-slate-800 hover:text-white transition-all shadow-lg flex items-center gap-2"
                style={{ fontSize: '14px' }}
            >
                <span>🧠</span>
                <span className="hidden sm:inline">Orchestrator</span>
            </button>
        </div>
    );
}
