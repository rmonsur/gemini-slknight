/**
 * orchestratorController.ts — API endpoints for the self-correcting orchestrator
 *
 * Exposes agent health, performance metrics, call logs, and test runner.
 * This is the "Marathon Agent" showcase — autonomous monitoring and self-correction.
 */

import { Router, Request, Response } from 'express';
import { getOrchestratorState, getAgentHealthMap, getRecentLogs, buildBorrowerChecklist, getChecklist, updateChecklistItem, getChecklistSessions, agentBus } from '../agents/orchestrator.js';
import { runTestSuite, runSmokeTest } from '../agents/agentTester.js';
import type { AgentName } from '../agents/orchestrator.js';

const router = Router();

/**
 * GET /api/orchestrator/health
 * Real-time health status of all agents
 */
router.get('/health', (_req: Request, res: Response) => {
    const state = getOrchestratorState();
    const healthMap = getAgentHealthMap();

    const agents = Object.values(healthMap).map(h => ({
        ...h,
        // Add human-readable status
        statusEmoji: h.status === 'healthy' ? '✅' : h.status === 'degraded' ? '⚠️' : '❌',
    }));

    // Overall system health
    const failingAgents = agents.filter(a => a.status === 'failing').length;
    const degradedAgents = agents.filter(a => a.status === 'degraded').length;
    const systemStatus = failingAgents > 0 ? 'failing'
        : degradedAgents > 2 ? 'degraded'
        : 'healthy';

    res.json({
        success: true,
        system: {
            status: systemStatus,
            totalCalls: state.totalCalls,
            totalCorrections: state.totalCorrections,
            correctionRate: state.totalCalls > 0
                ? `${((state.totalCorrections / state.totalCalls) * 100).toFixed(1)}%`
                : '0%',
            upSince: state.upSince,
            activeAgents: agents.filter(a => a.totalCalls > 0).length,
            totalAgents: agents.length,
        },
        agents,
    });
});

/**
 * GET /api/orchestrator/logs
 * Recent call logs with quality scores
 */
router.get('/logs', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const agent = req.query.agent as AgentName | undefined;

    let logs = getRecentLogs(limit);

    if (agent) {
        logs = logs.filter(l => l.agent === agent);
    }

    res.json({
        success: true,
        count: logs.length,
        logs,
    });
});

/**
 * POST /api/orchestrator/test
 * Trigger autonomous test suite
 * SSE endpoint — streams test results as they complete
 */
router.post('/test', async (req: Request, res: Response) => {
    const { agents, quick } = req.body as { agents?: AgentName[]; quick?: boolean };

    // Set SSE headers (X-Accel-Buffering required for Cloud Run streaming)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
        res.write(`data: ${JSON.stringify({ type: 'status', text: 'Starting test suite...' })}\n\n`);

        const suite = quick
            ? await runSmokeTest()
            : await runTestSuite({ agents });

        // Stream each result
        for (const result of suite.results) {
            res.write(`data: ${JSON.stringify({ type: 'result', data: result })}\n\n`);
        }

        // Send summary
        res.write(`data: ${JSON.stringify({
            type: 'summary',
            data: {
                runId: suite.runId,
                totalTests: suite.totalTests,
                passed: suite.passed,
                failed: suite.failed,
                overallHealth: suite.overallHealth,
                startedAt: suite.startedAt,
                completedAt: suite.completedAt,
            },
        })}\n\n`);

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
    } catch (error) {
        console.error('[OrchestratorController] Test error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Test suite failed' })}\n\n`);
        res.end();
    }
});

/**
 * GET /api/orchestrator/state
 * Full orchestrator state dump (for debugging)
 */
router.get('/state', (_req: Request, res: Response) => {
    res.json({
        success: true,
        state: getOrchestratorState(),
    });
});

// =====================================================
// AGENT FEED — SSE endpoint streaming all bus events
// =====================================================

/**
 * GET /api/orchestrator/feed
 * SSE stream of all agent bus events in real-time.
 * Frontend connects once and receives events as agents trigger each other.
 */
router.get('/feed', (req: Request, res: Response) => {
    // X-Accel-Buffering required for Cloud Run streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send recent events as initial payload
    const recent = agentBus.getRecentEvents(30);
    for (const event of recent) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // Subscribe to new events
    const unsubscribe = agentBus.subscribe((event) => {
        try {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch {
            unsubscribe();
        }
    });

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
        try {
            res.write(`: heartbeat\n\n`);
        } catch {
            clearInterval(heartbeat);
            unsubscribe();
        }
    }, 15000);

    // Cleanup on client disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
    });
});

// =====================================================
// CHECKLIST ENDPOINTS — Task tracking for agents
// =====================================================

/**
 * POST /api/orchestrator/checklist
 * Create a new borrower action checklist
 */
router.post('/checklist', (req: Request, res: Response) => {
    const { sessionId } = req.body as { sessionId?: string };
    const id = sessionId || `session_${Date.now()}`;
    const items = buildBorrowerChecklist(id);

    res.json({
        success: true,
        sessionId: id,
        checklist: items,
    });
});

/**
 * GET /api/orchestrator/checklist/:sessionId
 * Get checklist for a session
 */
router.get('/checklist/:sessionId', (req: Request, res: Response) => {
    const items = getChecklist(req.params.sessionId as string);
    const completed = items.filter(i => i.status === 'completed').length;
    const total = items.length;

    res.json({
        success: true,
        checklist: items,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
        completed,
        total,
    });
});

/**
 * PATCH /api/orchestrator/checklist/:sessionId/:itemId
 * Update a checklist item
 */
router.patch('/checklist/:sessionId/:itemId', (req: Request, res: Response) => {
    const { status, progress, result, decision } = req.body;
    const item = updateChecklistItem(req.params.sessionId as string, req.params.itemId as string, {
        status,
        progress,
        result,
        decision,
        ...(status === 'in_progress' ? { startedAt: new Date().toISOString() } : {}),
        ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
    });

    if (!item) {
        res.status(404).json({ success: false, error: 'Item not found' });
        return;
    }

    res.json({ success: true, item });
});

/**
 * GET /api/orchestrator/checklist-sessions
 * List all sessions with checklists
 */
router.get('/checklist-sessions', (_req: Request, res: Response) => {
    res.json({
        success: true,
        sessions: getChecklistSessions(),
    });
});

export default router;
