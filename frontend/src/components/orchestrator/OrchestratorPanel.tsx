// @ts-nocheck
'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface AgentHealth {
    agent: string;
    totalCalls: number;
    successRate: number;
    avgQualityScore: number;
    avgLatencyMs: number;
    lastCallAt: string | null;
    lastError: string | null;
    status: 'healthy' | 'degraded' | 'failing';
    recentCorrections: string[];
}

interface SystemHealth {
    status: string;
    totalCalls: number;
    totalCorrections: number;
    correctionRate: string;
    upSince: string;
    activeAgents: number;
    totalAgents: number;
}

interface TestResult {
    testId: string;
    agent: string;
    name: string;
    passed: boolean;
    score: number;
    reasoning: string;
    durationMs: number;
    error?: string;
}

interface ChecklistItem {
    id: string;
    task: string;
    description: string;
    assignedAgent: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress: number;
    result?: string;
    decision?: string;
    startedAt?: string;
    completedAt?: string;
}

const STATUS_COLORS: Record<string, string> = {
    healthy: 'text-emerald-400',
    degraded: 'text-amber-400',
    failing: 'text-red-400',
};

const STATUS_BG: Record<string, string> = {
    healthy: 'bg-emerald-500/10 border-emerald-500/20',
    degraded: 'bg-amber-500/10 border-amber-500/20',
    failing: 'bg-red-500/10 border-red-500/20',
};

const AGENT_LABELS: Record<string, string> = {
    freedom: 'Freedom Path',
    watchdog: 'Watchdog Scout',
    coach: 'Drill Sergeant',
    simulator: 'Life Architect',
    auditor: 'Forensic Accountant',
    vision: 'Vision Extract',
    letter: 'Letter Writer',
    debate: 'Hawk vs Dove',
    'call-script': 'Call Prep',
    'future-self': 'Future Self',
};

const AGENT_MODELS: Record<string, string> = {
    freedom: 'Gemini 3 Pro',
    watchdog: 'Gemini 3 Pro',
    coach: 'Gemini 3 Flash',
    simulator: 'Gemini 3 Pro',
    auditor: 'Gemini 3 Vision',
    vision: 'Gemini 3 Vision',
    letter: 'Gemini 3 Pro',
    debate: 'Gemini 3 Pro',
    'call-script': 'Gemini 3 Pro',
    'future-self': 'Gemini 3 Flash',
};

const CHECKLIST_STATUS_ICONS: Record<string, string> = {
    pending: '⏳',
    in_progress: '🔄',
    completed: '✅',
    failed: '❌',
};

interface OrchestratorPanelProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId?: string;
}

type Tab = 'checklist' | 'health' | 'tests';

export default function OrchestratorPanel({ isOpen, onClose, sessionId }: OrchestratorPanelProps) {
    const [activeTab, setActiveTab] = useState<Tab>('checklist');
    const [connected, setConnected] = useState(true);
    const [system, setSystem] = useState<SystemHealth | null>(null);
    const [agents, setAgents] = useState<AgentHealth[]>([]);
    const [testResults, setTestResults] = useState<TestResult[]>([]);
    const [testing, setTesting] = useState(false);
    const [testSummary, setTestSummary] = useState<{ passed: number; failed: number; total: number } | null>(null);

    // Checklist state
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [checklistProgress, setChecklistProgress] = useState(0);
    const [currentSessionId, setCurrentSessionId] = useState(sessionId || '');

    const fetchHealth = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/orchestrator/health`);
            if (!res.ok) throw new Error('Not OK');
            const data = await res.json();
            if (data.success) {
                setSystem(data.system);
                setAgents(data.agents);
                setConnected(true);
            }
        } catch {
            setConnected(false);
        }
    }, []);

    const fetchChecklist = useCallback(async (sid: string) => {
        if (!sid) return;
        try {
            const res = await fetch(`${API_BASE}/api/orchestrator/checklist/${sid}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.success) {
                setChecklist(data.checklist);
                setChecklistProgress(data.progress);
            }
        } catch {
            // Checklist not found — that's OK
        }
    }, []);

    const createChecklist = useCallback(async () => {
        try {
            const sid = currentSessionId || `session_${Date.now()}`;
            const res = await fetch(`${API_BASE}/api/orchestrator/checklist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sid }),
            });
            const data = await res.json();
            if (data.success) {
                setCurrentSessionId(data.sessionId);
                setChecklist(data.checklist);
                setChecklistProgress(0);
            }
        } catch {
            console.error('Failed to create checklist');
        }
    }, [currentSessionId]);

    // Poll health every 5 seconds when open
    useEffect(() => {
        if (!isOpen) return;
        fetchHealth();
        const interval = setInterval(fetchHealth, 5000);
        return () => clearInterval(interval);
    }, [isOpen, fetchHealth]);

    // Fetch checklist when tab switches or session changes
    useEffect(() => {
        if (!isOpen || !currentSessionId) return;
        fetchChecklist(currentSessionId);
        const interval = setInterval(() => fetchChecklist(currentSessionId), 3000);
        return () => clearInterval(interval);
    }, [isOpen, currentSessionId, fetchChecklist]);

    // Set session from prop
    useEffect(() => {
        if (sessionId) setCurrentSessionId(sessionId);
    }, [sessionId]);

    // Auto-create checklist when panel opens and none exists
    useEffect(() => {
        if (!isOpen || !connected) return;
        if (checklist.length > 0) return;
        // Auto-generate on open
        createChecklist();
    }, [isOpen, connected, checklist.length, createChecklist]);

    const runTests = useCallback(async (quick = false) => {
        setTesting(true);
        setTestResults([]);
        setTestSummary(null);

        try {
            const res = await fetch(`${API_BASE}/api/orchestrator/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quick }),
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
                        if (data.type === 'result') {
                            setTestResults(prev => [...prev, data.data]);
                        } else if (data.type === 'summary') {
                            setTestSummary({
                                passed: data.data.passed,
                                failed: data.data.failed,
                                total: data.data.totalTests,
                            });
                        }
                    } catch { /* skip */ }
                }
            }
        } catch (e) {
            console.error('Test run failed:', e);
        } finally {
            setTesting(false);
            fetchHealth();
        }
    }, [fetchHealth]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
                <div className="absolute inset-0 bg-black/60" onClick={onClose} />
                <motion.div
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 20 }}
                    className="relative bg-slate-900 rounded-2xl border border-white/10 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 bg-black/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-white font-bold flex items-center gap-3" style={{ fontSize: '20px' }}>
                                    <span className="text-2xl">🧠</span>
                                    Agent Orchestrator
                                    {!connected && (
                                        <span className="text-red-400 font-normal" style={{ fontSize: '14px' }}>
                                            (Connecting...)
                                        </span>
                                    )}
                                </h2>
                                {connected && system && (
                                    <div className="flex items-center gap-4 mt-2">
                                        <span className={`font-semibold ${STATUS_COLORS[system.status]}`} style={{ fontSize: '14px' }}>
                                            System: {system.status.toUpperCase()}
                                        </span>
                                        <span className="text-white/50" style={{ fontSize: '14px' }}>
                                            {system.totalCalls} calls | {system.totalCorrections} corrections ({system.correctionRate})
                                        </span>
                                        <span className="text-white/50" style={{ fontSize: '14px' }}>
                                            {system.activeAgents}/{system.totalAgents} agents active
                                        </span>
                                    </div>
                                )}
                                {!connected && (
                                    <p className="text-white/40 mt-1" style={{ fontSize: '14px' }}>
                                        Start the backend server to see live agent metrics
                                    </p>
                                )}
                            </div>
                            <button onClick={onClose} className="text-white/60 hover:text-white text-2xl p-2">×</button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-1 mt-4">
                            {(['checklist', 'health', 'tests'] as Tab[]).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-lg transition font-medium ${activeTab === tab ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
                                    style={{ fontSize: '14px' }}
                                >
                                    {tab === 'checklist' ? '📋 Checklist' : tab === 'health' ? '💚 Agent Health' : '🧪 Tests'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">

                        {/* ===== CHECKLIST TAB ===== */}
                        {activeTab === 'checklist' && (
                            <div>
                                {checklist.length === 0 ? (
                                    <div className="flex items-center justify-center gap-3 py-12">
                                        <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-white/60" style={{ fontSize: '16px' }}>
                                            Generating action checklist...
                                        </span>
                                    </div>
                                ) : (
                                    <>
                                        {/* Progress bar */}
                                        <div className="mb-6">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-white/80 font-semibold" style={{ fontSize: '16px' }}>
                                                    Overall Progress
                                                </span>
                                                <span className="text-emerald-400 font-bold" style={{ fontSize: '16px' }}>
                                                    {checklistProgress}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-white/10 rounded-full h-3">
                                                <motion.div
                                                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${checklistProgress}%` }}
                                                    transition={{ duration: 0.5 }}
                                                />
                                            </div>
                                        </div>

                                        {/* Checklist items */}
                                        <div className="space-y-3">
                                            {checklist.map((item, i) => (
                                                <motion.div
                                                    key={item.id}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    className={`rounded-xl border p-4 ${
                                                        item.status === 'completed' ? 'bg-emerald-500/5 border-emerald-500/20' :
                                                        item.status === 'in_progress' ? 'bg-sky-500/5 border-sky-500/20' :
                                                        item.status === 'failed' ? 'bg-red-500/5 border-red-500/20' :
                                                        'bg-white/5 border-white/10'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <span className="text-xl mt-0.5">
                                                            {CHECKLIST_STATUS_ICONS[item.status]}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className={`font-semibold ${item.status === 'completed' ? 'text-emerald-400' : 'text-white/90'}`} style={{ fontSize: '16px' }}>
                                                                    {item.task}
                                                                </span>
                                                                <span className="text-white/40 shrink-0 flex items-center gap-1.5" style={{ fontSize: '13px' }}>
                                                                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400/60" />
                                                                    {AGENT_LABELS[item.assignedAgent] || item.assignedAgent}
                                                                </span>
                                                            </div>
                                                            <p className="text-white/50 mt-1" style={{ fontSize: '14px' }}>
                                                                {item.description}
                                                            </p>

                                                            {/* Progress bar for in-progress items */}
                                                            {item.status === 'in_progress' && (
                                                                <div className="mt-2 w-full bg-white/10 rounded-full h-1.5">
                                                                    <div
                                                                        className="bg-sky-400 h-1.5 rounded-full transition-all"
                                                                        style={{ width: `${item.progress}%` }}
                                                                    />
                                                                </div>
                                                            )}

                                                            {/* AI Decision */}
                                                            {item.decision && (
                                                                <div className="mt-2 bg-white/5 rounded-lg px-3 py-2">
                                                                    <span className="text-amber-400 font-medium" style={{ fontSize: '13px' }}>AI Decision: </span>
                                                                    <span className="text-white/70" style={{ fontSize: '13px' }}>{item.decision}</span>
                                                                </div>
                                                            )}

                                                            {/* Result */}
                                                            {item.result && (
                                                                <div className="mt-2 bg-white/5 rounded-lg px-3 py-2">
                                                                    <span className="text-emerald-400 font-medium" style={{ fontSize: '13px' }}>Result: </span>
                                                                    <span className="text-white/70" style={{ fontSize: '13px' }}>{item.result}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ===== HEALTH TAB ===== */}
                        {activeTab === 'health' && (
                            <div>
                                {!connected ? (
                                    <div className="text-center py-12">
                                        <div className="text-4xl mb-4">🔌</div>
                                        <p className="text-white/70 mb-2" style={{ fontSize: '18px' }}>
                                            Backend not connected
                                        </p>
                                        <p className="text-white/40 mb-4" style={{ fontSize: '14px' }}>
                                            Start the backend server on port 3001 to see live agent health
                                        </p>
                                        <button
                                            onClick={fetchHealth}
                                            className="px-6 py-2.5 bg-white/10 text-white/80 rounded-lg hover:bg-white/20 transition"
                                            style={{ fontSize: '14px' }}
                                        >
                                            Retry Connection
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <h3 className="text-white/80 font-semibold mb-3" style={{ fontSize: '16px' }}>Agent Health</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                            {agents.map((agent) => (
                                                <div
                                                    key={agent.agent}
                                                    className={`rounded-xl border p-3 ${STATUS_BG[agent.status]} transition-all`}
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-white/90 font-medium truncate" style={{ fontSize: '13px' }}>
                                                            {AGENT_LABELS[agent.agent] || agent.agent}
                                                        </span>
                                                        <span className={STATUS_COLORS[agent.status]} style={{ fontSize: '12px' }}>
                                                            {agent.status === 'healthy' ? '✅' : agent.status === 'degraded' ? '⚠️' : '❌'}
                                                        </span>
                                                    </div>
                                                    <div className="text-white/40" style={{ fontSize: '11px' }}>
                                                        {AGENT_MODELS[agent.agent] || 'Gemini'}
                                                    </div>
                                                    <div className="mt-2 space-y-1">
                                                        <div className="flex justify-between">
                                                            <span className="text-white/40" style={{ fontSize: '11px' }}>Calls</span>
                                                            <span className="text-white/70" style={{ fontSize: '11px' }}>{agent.totalCalls}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-white/40" style={{ fontSize: '11px' }}>Success</span>
                                                            <span className={`${agent.successRate >= 80 ? 'text-emerald-400' : agent.successRate >= 50 ? 'text-amber-400' : 'text-red-400'}`} style={{ fontSize: '11px' }}>
                                                                {agent.successRate}%
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-white/40" style={{ fontSize: '11px' }}>Quality</span>
                                                            <span className="text-white/70" style={{ fontSize: '11px' }}>{agent.avgQualityScore}/100</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-white/40" style={{ fontSize: '11px' }}>Latency</span>
                                                            <span className="text-white/70" style={{ fontSize: '11px' }}>{agent.avgLatencyMs}ms</span>
                                                        </div>
                                                    </div>
                                                    {agent.recentCorrections.length > 0 && (
                                                        <div className="mt-2 pt-2 border-t border-white/10">
                                                            <span className="text-amber-400/70" style={{ fontSize: '10px' }}>
                                                                {agent.recentCorrections.length} correction(s)
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Self-Correction Log */}
                                        {agents.some(a => a.recentCorrections.length > 0) && (
                                            <div className="mt-6">
                                                <h3 className="text-white/80 font-semibold mb-3" style={{ fontSize: '16px' }}>
                                                    Self-Correction Log
                                                </h3>
                                                <div className="space-y-2">
                                                    {agents
                                                        .filter(a => a.recentCorrections.length > 0)
                                                        .flatMap(a => a.recentCorrections.map((c, i) => ({
                                                            agent: a.agent,
                                                            correction: c,
                                                            key: `${a.agent}-${i}`,
                                                        })))
                                                        .map(({ agent, correction, key }) => (
                                                            <div key={key} className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
                                                                <span style={{ fontSize: '14px' }}>🔧</span>
                                                                <div>
                                                                    <span className="text-amber-400 font-medium" style={{ fontSize: '13px' }}>
                                                                        {AGENT_LABELS[agent] || agent}
                                                                    </span>
                                                                    <p className="text-white/60" style={{ fontSize: '13px' }}>{correction}</p>
                                                                </div>
                                                            </div>
                                                        ))
                                                    }
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {/* ===== TESTS TAB ===== */}
                        {activeTab === 'tests' && (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-white/80 font-semibold" style={{ fontSize: '16px' }}>
                                        Autonomous Test Runner
                                    </h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => runTests(true)}
                                            disabled={testing || !connected}
                                            className="px-4 py-2 bg-white/10 text-white/80 rounded-lg hover:bg-white/20 transition disabled:opacity-50"
                                            style={{ fontSize: '14px' }}
                                        >
                                            {testing ? 'Running...' : 'Quick Test'}
                                        </button>
                                        <button
                                            onClick={() => runTests(false)}
                                            disabled={testing || !connected}
                                            className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition disabled:opacity-50"
                                            style={{ fontSize: '14px' }}
                                        >
                                            {testing ? 'Testing All Agents...' : 'Run Full Test Suite'}
                                        </button>
                                    </div>
                                </div>

                                {!connected && (
                                    <div className="text-center py-8 text-white/30" style={{ fontSize: '14px' }}>
                                        Connect to backend to run tests.
                                    </div>
                                )}

                                {/* Test Summary */}
                                {testSummary && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`rounded-xl p-4 mb-3 border ${testSummary.failed === 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}
                                    >
                                        <span className="text-white font-semibold" style={{ fontSize: '16px' }}>
                                            {testSummary.failed === 0 ? '✅ All Tests Passed' : `⚠️ ${testSummary.failed} Test(s) Failed`}
                                        </span>
                                        <span className="text-white/60 ml-3" style={{ fontSize: '14px' }}>
                                            {testSummary.passed}/{testSummary.total} passed
                                        </span>
                                    </motion.div>
                                )}

                                {/* Test Results */}
                                {testResults.length > 0 && (
                                    <div className="space-y-2">
                                        {testResults.map((result, i) => (
                                            <motion.div
                                                key={result.testId}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className={`rounded-lg p-3 border ${result.passed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span style={{ fontSize: '14px' }}>{result.passed ? '✅' : '❌'}</span>
                                                        <span className="text-white/90 font-medium" style={{ fontSize: '14px' }}>{result.name}</span>
                                                        <span className="text-white/40" style={{ fontSize: '12px' }}>({result.agent})</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`font-semibold ${result.score >= 70 ? 'text-emerald-400' : result.score >= 40 ? 'text-amber-400' : 'text-red-400'}`} style={{ fontSize: '14px' }}>
                                                            {result.score}/100
                                                        </span>
                                                        <span className="text-white/40" style={{ fontSize: '12px' }}>{result.durationMs}ms</span>
                                                    </div>
                                                </div>
                                                <p className="text-white/60 mt-1" style={{ fontSize: '13px' }}>
                                                    {result.reasoning}
                                                </p>
                                                {result.error && (
                                                    <p className="text-red-400/80 mt-1" style={{ fontSize: '12px' }}>
                                                        Error: {result.error}
                                                    </p>
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>
                                )}

                                {connected && testResults.length === 0 && !testing && (
                                    <div className="text-center py-8 text-white/30" style={{ fontSize: '14px' }}>
                                        Run the test suite to see results. Gemini evaluates each agent's output autonomously.
                                    </div>
                                )}

                                {testing && testResults.length === 0 && (
                                    <div className="flex items-center justify-center gap-3 py-8">
                                        <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-white/60" style={{ fontSize: '16px' }}>Running autonomous tests...</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
