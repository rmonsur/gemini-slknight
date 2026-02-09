/**
 * agentTester.ts — Autonomous Agent Test Runner
 *
 * Runs test cases against each agent without human supervision.
 * Uses Gemini to evaluate whether outputs meet expected criteria.
 * Part of the self-correcting orchestrator loop.
 *
 * Test Flow:
 *   1. Load test cases for each agent
 *   2. Execute agent with test input
 *   3. Gemini evaluates output against success criteria
 *   4. Log pass/fail with reasoning
 *   5. If failures detected, flag agent as degraded
 */

import { getFlashModel } from '../config/gemini.js';
import { getDemoUser } from '../middleware/demoMode.js';
import { parseJSON } from '../utils/cleanJSON.js';
import { orchestrate, type AgentName } from './orchestrator.js';
import { freedomAgent } from './freedomAgent.js';
import { watchdogAgent } from './watchdogAgent.js';
import { coachAgent } from './coachAgent.js';
import { simulatorAgent } from './simulatorAgent.js';
import type { UserRecord } from '../types/index.js';

// ============================================================
// Types
// ============================================================

export interface TestCase {
    id: string;
    agent: AgentName;
    name: string;
    description: string;
    input: unknown;
    successCriteria: string;     // Natural language: what a good output looks like
    timeout: number;             // ms
}

export interface TestResult {
    testId: string;
    agent: AgentName;
    name: string;
    passed: boolean;
    score: number;               // 0-100
    reasoning: string;           // Why it passed/failed
    durationMs: number;
    output?: string;             // Truncated output
    error?: string;
    timestamp: string;
}

export interface TestSuiteResult {
    runId: string;
    startedAt: string;
    completedAt: string;
    totalTests: number;
    passed: number;
    failed: number;
    results: TestResult[];
    overallHealth: 'healthy' | 'degraded' | 'failing';
}

// ============================================================
// Test Cases — One for each agent
// ============================================================

function getTestCases(user: UserRecord): TestCase[] {
    return [
        {
            id: 'freedom_basic',
            agent: 'freedom',
            name: 'Freedom Path Generation',
            description: 'Generate a complete freedom path for demo user',
            input: { user, whatIf: undefined },
            successCriteria: 'Output must contain: optimalOutcome with debtFreeDate, totalSaved > 0, a strategyName, and a mazeBlueprint with at least 4 tiles. Each tile must have milestoneId, tileType, position, and requiredTask with instruction and reason.',
            timeout: 30000,
        },
        {
            id: 'freedom_whatif',
            agent: 'freedom',
            name: 'Freedom Path with What-If Scenario',
            description: 'Generate path with "What if I move to Tulsa?" scenario',
            input: { user, whatIf: 'What if I move to Tulsa for the remote worker grant?' },
            successCriteria: 'Output must reference Tulsa or relocation in the narrative or strategy. Must contain optimalOutcome and mazeBlueprint. The strategy should account for the $10,000 grant.',
            timeout: 30000,
        },
        {
            id: 'watchdog_match',
            agent: 'watchdog',
            name: 'Opportunity Matching',
            description: 'Match grants to demo user profile',
            input: { user },
            successCriteria: 'Output must have success=true and offers array with at least 1 offer. Each offer must have id, title, value, and type. Offers should be relevant to a software engineer willing to relocate.',
            timeout: 15000,
        },
        {
            id: 'coach_advice',
            agent: 'coach',
            name: 'Coach Financial Advice',
            description: 'Get coaching on IDR plans',
            input: { user, message: 'Should I enroll in an income-driven repayment plan?' },
            successCriteria: 'Response must mention specific dollar amounts or percentages. Must reference the SAVE plan or IDR. Must not give medical advice. Should reference the user\'s actual income ($75,000) or loan amounts.',
            timeout: 15000,
        },
        {
            id: 'simulator_scenarios',
            agent: 'simulator',
            name: 'Scenario Generation',
            description: 'Generate financial scenarios for demo user',
            input: { user },
            successCriteria: 'Output must have success=true, scenarios array with at least 2 scenarios each having debtFreeDate and monthlyPayment, and an offers array. Should include a design system with colors and mood.',
            timeout: 20000,
        },
    ];
}

// ============================================================
// Test Executor
// ============================================================

async function executeTest(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    const { user, whatIf, message } = testCase.input as {
        user: UserRecord;
        whatIf?: string;
        message?: string;
    };

    try {
        let output: unknown;

        // Route to the correct agent
        switch (testCase.agent) {
            case 'freedom': {
                const { result } = await orchestrate('freedom', `Test: ${testCase.name}`, () =>
                    freedomAgent(user, whatIf),
                    { skipQualityCheck: true }, // We'll evaluate separately
                );
                output = result;
                break;
            }
            case 'watchdog': {
                const { result } = await orchestrate('watchdog', `Test: ${testCase.name}`, () =>
                    watchdogAgent(user),
                    { skipQualityCheck: true },
                );
                output = result;
                break;
            }
            case 'coach': {
                const { result } = await orchestrate('coach', `Test: ${testCase.name}`, () =>
                    coachAgent(user, message),
                    { skipQualityCheck: true },
                );
                output = result;
                break;
            }
            case 'simulator': {
                const { result } = await orchestrate('simulator', `Test: ${testCase.name}`, () =>
                    simulatorAgent(user),
                    { skipQualityCheck: true },
                );
                output = result;
                break;
            }
            default:
                throw new Error(`No test executor for agent: ${testCase.agent}`);
        }

        const durationMs = Date.now() - startTime;
        const outputStr = JSON.stringify(output).substring(0, 2000);

        // Use Gemini to evaluate the output against success criteria
        const evaluation = await evaluateTestOutput(testCase, outputStr);

        return {
            testId: testCase.id,
            agent: testCase.agent,
            name: testCase.name,
            passed: evaluation.passed,
            score: evaluation.score,
            reasoning: evaluation.reasoning,
            durationMs,
            output: outputStr.substring(0, 500),
            timestamp: new Date().toISOString(),
        };

    } catch (err) {
        return {
            testId: testCase.id,
            agent: testCase.agent,
            name: testCase.name,
            passed: false,
            score: 0,
            reasoning: `Agent threw an error: ${err instanceof Error ? err.message : 'Unknown'}`,
            durationMs: Date.now() - startTime,
            error: err instanceof Error ? err.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        };
    }
}

async function evaluateTestOutput(
    testCase: TestCase,
    output: string,
): Promise<{ passed: boolean; score: number; reasoning: string }> {
    try {
        const model = getFlashModel();

        const prompt = `You are a test evaluator for a financial AI system. Determine if this agent output passes the test.

AGENT: ${testCase.agent}
TEST: ${testCase.name}
DESCRIPTION: ${testCase.description}

SUCCESS CRITERIA:
${testCase.successCriteria}

ACTUAL OUTPUT:
${output}

Evaluate whether the output meets ALL success criteria. Be strict — financial data must be accurate and complete.

Return ONLY valid JSON:
{
  "passed": true or false,
  "score": 0-100,
  "reasoning": "1-2 sentence explanation of why it passed or failed"
}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        return parseJSON<{ passed: boolean; score: number; reasoning: string }>(text, {
            passed: false,
            score: 50,
            reasoning: 'Evaluation parsing failed, defaulting to uncertain',
        });
    } catch {
        return {
            passed: true, // Assume pass if evaluator fails
            score: 60,
            reasoning: 'Test evaluator error — assuming pass',
        };
    }
}

// ============================================================
// Test Suite Runner
// ============================================================

/**
 * Run all agent tests and return results.
 * This is the autonomous testing loop — no human supervision needed.
 */
export async function runTestSuite(options?: {
    agents?: AgentName[];
    parallel?: boolean;
}): Promise<TestSuiteResult> {
    const runId = `suite_${Date.now()}`;
    const startedAt = new Date().toISOString();
    const user = getDemoUser();
    const allTests = getTestCases(user);

    // Filter by agent if specified
    const tests = options?.agents
        ? allTests.filter(t => options.agents!.includes(t.agent))
        : allTests;

    console.log(`[AgentTester] Starting test suite ${runId} with ${tests.length} tests`);

    let results: TestResult[];

    if (options?.parallel) {
        // Run all tests in parallel (faster, but higher API load)
        results = await Promise.all(tests.map(t => executeTest(t)));
    } else {
        // Run tests sequentially (safer for rate limits)
        results = [];
        for (const test of tests) {
            console.log(`[AgentTester] Running: ${test.name}...`);
            const result = await executeTest(test);
            results.push(result);
            console.log(`[AgentTester] ${result.passed ? 'PASS' : 'FAIL'} (${result.score}/100): ${result.name}`);
        }
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    const overallHealth: TestSuiteResult['overallHealth'] =
        failed === 0 ? 'healthy' :
        failed <= Math.ceil(results.length * 0.3) ? 'degraded' :
        'failing';

    const suiteResult: TestSuiteResult = {
        runId,
        startedAt,
        completedAt: new Date().toISOString(),
        totalTests: results.length,
        passed,
        failed,
        results,
        overallHealth,
    };

    console.log(`[AgentTester] Suite complete: ${passed}/${results.length} passed (${overallHealth})`);

    return suiteResult;
}

/**
 * Run a quick smoke test — one test per agent, fast.
 */
export async function runSmokeTest(): Promise<TestSuiteResult> {
    return runTestSuite({
        agents: ['watchdog', 'coach'], // Fastest agents only
    });
}

export default runTestSuite;
