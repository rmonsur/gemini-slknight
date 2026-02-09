/**
 * simulatorController.ts — API endpoints for Stage 1 (Simulator)
 */

import { Router, Request, Response } from 'express';
import { simulatorAgent } from '../agents/simulatorAgent.js';
import { getDemoUser, getDemoScenarios, getDemoOffers } from '../middleware/demoMode.js';
import type { LifecycleStage } from '../types/index.js';

const router = Router();

/**
 * GET /api/simulator/scenarios
 * Returns pre-computed or generated scenarios for the user
 */
router.get('/scenarios', async (_req: Request, res: Response) => {
    try {
        const user = getDemoUser();

        // For demo, return pre-computed scenarios for speed
        if (user.isDemo) {
            const scenarios = getDemoScenarios();
            const offers = getDemoOffers();

            res.json({
                success: true,
                designSystem: {
                    primaryColor: '#6366F1',
                    secondaryColor: '#1E1B4B',
                    fontHeader: 'Playfair Display',
                    fontBody: 'Inter',
                    mood: 'NEUTRAL',
                    backgroundGradient: ['#1E1B4B', '#312E81'],
                },
                scenarios: Object.values(scenarios),
                offers,
            });
            return;
        }

        // For real users, call the agent
        const response = await simulatorAgent(user);
        res.json(response);
    } catch (error) {
        console.error('[SimulatorController] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate scenarios',
        });
    }
});

/**
 * POST /api/simulator/generate
 * Triggers fresh scenario generation with custom parameters
 */
router.post('/generate', async (req: Request, res: Response) => {
    try {
        const user = getDemoUser();
        const params = req.body as {
            monthlyPayment?: number;
            targetCity?: string;
            willingnessToRelocate?: boolean;
        };

        // Merge custom params into user profile for generation
        const modifiedUser = {
            ...user,
            profile: {
                ...user.profile,
                targetCity: params.targetCity || user.profile.targetCity,
                willingnessToRelocate: params.willingnessToRelocate ?? user.profile.willingnessToRelocate,
            },
        };

        const response = await simulatorAgent(modifiedUser, params);
        res.json(response);
    } catch (error) {
        console.error('[SimulatorController] Generate error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate custom scenarios',
        });
    }
});

/**
 * GET /api/simulator/user
 * Returns current demo user profile
 */
router.get('/user', (_req: Request, res: Response) => {
    const user = getDemoUser();
    res.json({
        success: true,
        user,
    });
});

/**
 * POST /api/simulator/stage
 * Switch demo user stage (for demo stage switcher)
 */
router.post('/stage', (req: Request, res: Response) => {
    const { stage } = req.body as { stage: LifecycleStage };

    const validStages: LifecycleStage[] = [
        'STAGE_1_SIMULATOR',
        'STAGE_2_COACH',
        'STAGE_3_AUDITOR',
        'STAGE_4_OPTIMIZER',
    ];

    if (!validStages.includes(stage)) {
        res.status(400).json({
            success: false,
            error: 'Invalid stage',
        });
        return;
    }

    // In production this would update Firestore
    // For demo, just acknowledge the change
    res.json({
        success: true,
        stage,
        message: `Switched to ${stage}`,
    });
});

// =====================================================
// FREEDOM PATH SSE ENDPOINTS — "Reverse Engineer Your Freedom"
// =====================================================

import { freedomAgent, streamFreedomNarrative } from '../agents/freedomAgent.js';
import { getFlashModel, getProModel, getVisionModel } from '../config/gemini.js';
import { watchdogAgent, OPPORTUNITY_DATABASE } from '../agents/watchdogAgent.js';
import { parseJSON } from '../utils/cleanJSON.js';
import { orchestrate, emitAgentEvent } from '../agents/orchestrator.js';
import { agentBus } from '../agents/agentBus.js';

/**
 * POST /api/simulator/freedom-path
 * SSE endpoint for generating the Freedom Path
 * Phase 1: Stream narrative text
 * Phase 2: Send complete structured Freedom Path
 */
router.post('/freedom-path', async (req: Request, res: Response) => {
    const { whatIf } = req.body as { whatIf?: string };

    // Set SSE headers (X-Accel-Buffering required for Cloud Run streaming)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
        const user = getDemoUser();

        // Phase 1: Stream the narrative hook
        console.log('[FreedomPath] Starting narrative stream...');
        const narrativeStream = streamFreedomNarrative(user, whatIf);

        for await (const chunk of narrativeStream) {
            res.write(`data: ${JSON.stringify({ type: 'narrative', text: chunk })}\n\n`);
        }

        // Phase 2: Generate structured Freedom Path (through orchestrator)
        console.log('[FreedomPath] Generating structured path...');
        const { result: freedomPath } = await orchestrate(
            'freedom',
            `Generate freedom path${whatIf ? ` with scenario: ${whatIf}` : ''}`,
            () => freedomAgent(user, whatIf),
            { maxRetries: 1 },
        );

        res.write(`data: ${JSON.stringify({ type: 'freedomPath', data: freedomPath })}\n\n`);

        // Emit bus event
        emitAgentEvent(
            'freedom:updated',
            'freedom',
            `Freedom path generated${whatIf ? ` (scenario: ${whatIf})` : ''}`,
            freedomPath,
        );

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);

        res.end();
    } catch (error) {
        console.error('[FreedomPath] Error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to generate Freedom Path' })}\n\n`);
        res.end();
    }
});

/**
 * POST /api/simulator/future-self
 * SSE endpoint for chatting with your "Future Self"
 */
router.post('/future-self', async (req: Request, res: Response) => {
    const { message, freedomPath } = req.body as { message: string; freedomPath?: string };

    // Set SSE headers (X-Accel-Buffering required for Cloud Run streaming)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
        const user = getDemoUser();
        const model = getFlashModel();

        // Build Future Self system prompt
        const debtFreeYear = freedomPath
            ? JSON.parse(freedomPath).optimalOutcome?.debtFreeDate?.split('-')[0] || '2030'
            : '2030';

        const systemPrompt = `You are ${user.profile.email?.split('@')[0] || 'the user'} in ${debtFreeYear}. You are DEBT-FREE and financially thriving.

You followed this path to freedom:
${freedomPath || 'A disciplined approach combining the SAVE plan, autopay enrollment, and eventual relocation to Tulsa for the $10,000 remote worker grant.'}

You are talking to your past self (${new Date().toISOString().split('T')[0]}) who is about to start this journey. Your job is to show them the FINANCIAL VALUE of the decisions ahead.

RULES:
- Lead with NUMBERS. Always mention specific dollar amounts: how much you saved, how much grants were worth, how much your investments grew, how much interest you avoided.
- Use first person ("I saved...", "I earned...", "My net worth went from...").
- Reference real relocation grants (Tulsa $10K, Topeka $15K, NW Arkansas $10K), forgiveness programs (PSLF, SAVE plan), refinancing rates, and employer benefits.
- When asked about struggles, frame them as financial trade-offs with dollar values ("That $200/month sacrifice turned into $14,000 in savings").
- Talk about compound growth: "The $10K Tulsa grant I put toward debt meant $23K less in lifetime interest."
- Mention specific opportunities: relocation incentives, employer match programs, state-specific grants, tax deductions.
- Keep responses to 3-5 sentences maximum.
- Every response MUST include at least one specific dollar amount or percentage.
- You are NOT a financial advisor — you are sharing what ACTUALLY happened financially on your journey.`;

        console.log('[FutureSelf] Streaming response...');

        // Use chat for multi-turn conversation
        const chat = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: systemPrompt }],
                },
                {
                    role: 'model',
                    parts: [{ text: `I understand. I'm ready to talk to my past self about our journey to debt freedom in ${debtFreeYear}.` }],
                },
            ],
        });

        const result = await chat.sendMessageStream(message);

        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
                res.write(`data: ${JSON.stringify({ type: 'response', text })}\n\n`);
            }
        }

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
    } catch (error) {
        console.error('[FutureSelf] Error:', error);
        // Fallback response
        res.write(`data: ${JSON.stringify({ type: 'response', text: "Right now you're looking at $55,000 in debt, but here's what the numbers look like from where I'm standing: the Tulsa Remote grant alone knocked $10,000 off the principal, which saved us $4,200 in interest over the life of the loan. Autopay's 0.25% rate reduction saved another $1,800. Between the SAVE plan restructuring and the aggressive payoff schedule, we turned $55K into $0 and redirected that $450/month payment into index funds that are already worth $12,000. The math works — I'm living proof." })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
    }
});

/**
 * POST /api/simulator/generate-letter
 * SSE endpoint for generating personalized letters
 */
router.post('/generate-letter', async (req: Request, res: Response) => {
    const { letterType, servicer } = req.body as { letterType: string; servicer: string };

    // Set SSE headers (X-Accel-Buffering required for Cloud Run streaming)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
        const user = getDemoUser();
        const model = getProModel();

        const letterPrompts: Record<string, string> = {
            SAVE_ENROLLMENT: `Generate a formal letter requesting enrollment in the SAVE income-driven repayment plan.`,
            RATE_REDUCTION: `Generate a formal letter requesting a rate reduction or autopay discount.`,
            FORBEARANCE: `Generate a formal letter requesting temporary hardship forbearance.`,
            PSLF_CERTIFICATION: `Generate a formal letter for PSLF employer certification.`,
        };

        const prompt = `You are a professional letter writer helping a student loan borrower.

BORROWER INFO:
- Account with ${servicer || 'the servicer'}
- Account ending in: ${user.financials.loans[0]?.id?.slice(-4) || '4567'}
- Total debt: $${user.financials.totalDebt.toLocaleString()}
- Current date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

TASK: ${letterPrompts[letterType] || 'Generate a professional servicer communication letter.'}

REQUIREMENTS:
- Include today's date at the top
- Include servicer address (use a realistic generic address if needed)
- Reference the account number
- Use professional, formal tone
- Include specific program name and relevant federal regulations if applicable
- End with a clear call to action
- Include signature line with the borrower's placeholder name

Write the complete, ready-to-send letter:`;

        console.log('[LetterWriter] Streaming letter...');

        const result = await model.generateContentStream(prompt);

        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
                res.write(`data: ${JSON.stringify({ type: 'letter', text })}\n\n`);
            }
        }

        // Emit bus event for letter generation
        emitAgentEvent(
            'letter:generated',
            'letter',
            `Generated ${letterType || 'servicer'} letter for ${servicer || 'servicer'}`,
            { letterType, servicer },
        );

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
    } catch (error) {
        console.error('[LetterWriter] Error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to generate letter' })}\n\n`);
        res.end();
    }
});

/**
 * POST /api/simulator/call-script
 * Returns a structured call preparation script
 */
router.post('/call-script', async (req: Request, res: Response) => {
    const { servicer, objective } = req.body as { servicer: string; objective: string };

    try {
        const user = getDemoUser();
        const model = getProModel();

        const prompt = `You are a call preparation assistant for student loan borrowers.

BORROWER:
- Calling: ${servicer || 'Nelnet'}
- Objective: ${objective || 'Enroll in autopay'}
- Account: Ending in ${user.financials.loans[0]?.id?.slice(-4) || '4567'}
- Total debt: $${user.financials.totalDebt.toLocaleString()}

Generate a JSON call script with:
{
  "servicerPhone": "<actual servicer 800 number>",
  "estimatedCallTime": "<e.g., '10-15 minutes'>",
  "openingStatement": "<exact words to say when agent answers>",
  "talkingPoints": [
    {
      "point": "<topic>",
      "script": "<exact words to say>",
      "anticipatedResponse": "<what the agent might say>",
      "rebuttal": "<what to say if they resist>"
    }
  ],
  "keyPhrases": ["<magic words that trigger specific actions>"],
  "closingStatement": "<how to end the call confirming everything>"
}

Be specific. Use real program names, common objections, and proven phrases.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const script = jsonMatch ? JSON.parse(jsonMatch[0]) : {
            servicerPhone: servicer === 'Nelnet' ? '1-888-486-4722' : '1-800-557-7394',
            estimatedCallTime: '10-15 minutes',
            openingStatement: `Hi, I'm calling about my student loan account ending in 4567. I'd like to ${objective?.toLowerCase() || 'enroll in autopay'}.`,
            talkingPoints: [
                {
                    point: objective || 'Autopay enrollment',
                    script: "I'd like to set up automatic payments to get the 0.25% interest rate reduction.",
                    anticipatedResponse: "I can help you with that. I'll need to verify your information.",
                    rebuttal: "Yes, I have my account number and bank details ready."
                }
            ],
            keyPhrases: ['autopay discount', '0.25% rate reduction', 'automatic debit'],
            closingStatement: "Can you confirm when the autopay will start and when the rate reduction takes effect?"
        };

        res.json({
            success: true,
            script,
        });
    } catch (error) {
        console.error('[CallScript] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate call script',
        });
    }
});

/**
 * POST /api/simulator/vision-extract
 * SSE endpoint: Gemini Vision reads a loan document screenshot,
 * then chains → watchdog (grant matching) → freedom agent (path recalculation)
 */
router.post('/vision-extract', async (req: Request, res: Response) => {
    const { image, mimeType } = req.body as { image: string; mimeType?: string };

    // Set SSE headers (X-Accel-Buffering required for Cloud Run streaming)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
        const user = getDemoUser();

        // === STEP 1: Vision Extraction ===
        res.write(`data: ${JSON.stringify({ type: 'status', step: 'vision', text: 'Analyzing your document with Gemini Vision...' })}\n\n`);

        const visionModel = getVisionModel();

        const visionPrompt = `You are a financial document analysis expert. Extract student loan information from this screenshot.

This could be a screenshot from Navient, Nelnet, Mohela, FedLoan, Great Lakes, or any loan servicer dashboard.

Extract ALL of the following fields you can find:
- servicerName: The loan servicer company name
- accountNumberLast4: Last 4 digits of account number
- interestRate: As a decimal (e.g., 0.068 for 6.8%). Look for "Interest Rate", "Rate", or APR fields.
- principalBalance: Current outstanding balance in dollars. Look for "Current Balance", "Principal Balance", "Amount Owed".
- monthlyPayment: Monthly payment amount. Look for "Monthly Payment", "Amount Due", "Payment Amount".
- dueDate: Next payment due date in YYYY-MM-DD format.
- loanType: One of SUBSIDIZED, UNSUBSIDIZED, or PRIVATE based on the loan description.
- loanStatus: Current status like "In Repayment", "In Grace Period", "Deferred", etc.

Return ONLY valid JSON. No markdown fences. No explanation.
{
  "extractedData": {
    "servicerName": "string or null",
    "accountNumberLast4": "string or null",
    "interestRate": "number or null",
    "principalBalance": "number or null",
    "monthlyPayment": "number or null",
    "dueDate": "string or null",
    "loanType": "string or null",
    "loanStatus": "string or null"
  },
  "confidence": 0.0 to 1.0,
  "rawText": "first 200 chars of text detected in the image"
}

If a field is not visible in the image, set it to null. Never guess — only extract what you can clearly read.`;

        const { result: extraction } = await orchestrate(
            'vision',
            'Extract loan data from uploaded document screenshot',
            async () => {
                const visionResult = await visionModel.generateContent([
                    { text: visionPrompt },
                    {
                        inlineData: {
                            mimeType: mimeType || 'image/png',
                            data: image,
                        },
                    },
                ]);

                const visionText = visionResult.response.text();
                console.log('[VisionExtract] Raw response:', visionText.substring(0, 300));

                return parseJSON<{
                    extractedData: Record<string, unknown>;
                    confidence: number;
                    rawText: string;
                }>(visionText, {
                    extractedData: {},
                    confidence: 0,
                    rawText: '',
                });
            },
            { maxRetries: 1 },
        );

        res.write(`data: ${JSON.stringify({ type: 'extraction', data: extraction })}\n\n`);

        // Emit bus event for vision extraction
        const chainId = agentBus.newChainId();
        const visionEvtId = emitAgentEvent(
            'vision:extracted',
            'vision',
            `Extracted loan data: ${Object.entries(extraction.extractedData).filter(([, v]) => v !== null).length} fields, ${Math.round(extraction.confidence * 100)}% confidence`,
            extraction,
            chainId,
            0,
            undefined,
            Date.now() - Date.now(), // will be overridden
        );

        // === STEP 2: Update user financials with extracted data ===
        const ext = extraction.extractedData;
        const updatedUser = { ...user };

        if (ext.principalBalance || ext.interestRate) {
            res.write(`data: ${JSON.stringify({ type: 'status', step: 'update', text: 'Updating your loan profile...' })}\n\n`);

            // If we got real data, update the user's loans
            if (ext.principalBalance && typeof ext.principalBalance === 'number') {
                updatedUser.financials = {
                    ...updatedUser.financials,
                    totalDebt: ext.principalBalance as number,
                    servicer: (ext.servicerName as string) || updatedUser.financials.servicer,
                };
                // Update first loan with extracted data
                if (updatedUser.financials.loans.length > 0) {
                    updatedUser.financials.loans[0] = {
                        ...updatedUser.financials.loans[0],
                        balance: ext.principalBalance as number,
                        rate: (ext.interestRate as number) || updatedUser.financials.loans[0].rate,
                        servicerName: (ext.servicerName as string) || updatedUser.financials.loans[0].servicerName,
                    };
                }
            }
        }

        // === STEP 3: Chain → Watchdog (find matching grants) ===
        res.write(`data: ${JSON.stringify({ type: 'status', step: 'watchdog', text: 'Scanning for matching grants and opportunities...' })}\n\n`);

        let matchedOffers;
        try {
            const { result: watchdogResult } = await orchestrate(
                'watchdog',
                'Vision chain: match grants to extracted loan data',
                () => watchdogAgent(updatedUser),
                { maxRetries: 1, skipQualityCheck: true },
            );
            matchedOffers = watchdogResult.offers || [];
        } catch {
            matchedOffers = OPPORTUNITY_DATABASE.slice(0, 5);
        }

        const grantsData = {
            count: matchedOffers.length,
            totalValue: matchedOffers.reduce((sum: number, o: { value: number }) => sum + o.value, 0),
            offers: matchedOffers,
        };
        res.write(`data: ${JSON.stringify({ type: 'grants', data: grantsData })}\n\n`);

        // Emit bus event for watchdog match
        emitAgentEvent(
            'watchdog:matched',
            'watchdog',
            `Matched ${matchedOffers.length} grants worth $${grantsData.totalValue.toLocaleString()}`,
            grantsData,
            chainId,
            1,
            undefined,
        );

        // === STEP 4: Chain → Freedom Agent (recalculate path) ===
        res.write(`data: ${JSON.stringify({ type: 'status', step: 'freedom', text: 'Recalculating your path to freedom...' })}\n\n`);

        let freedomPath;
        try {
            const { result } = await orchestrate(
                'freedom',
                'Vision chain: recalculate path with extracted loan data',
                () => freedomAgent(updatedUser),
                { maxRetries: 1, skipQualityCheck: true },
            );
            freedomPath = result;
        } catch {
            freedomPath = null;
        }

        if (freedomPath) {
            res.write(`data: ${JSON.stringify({ type: 'freedomPath', data: freedomPath })}\n\n`);

            // Emit bus event for freedom path update
            emitAgentEvent(
                'freedom:updated',
                'freedom',
                `Path recalculated with extracted data`,
                freedomPath,
                chainId,
                2,
                undefined,
            );
        }

        // Complete the chain
        agentBus.completeChain(chainId);

        // === DONE ===
        res.write(`data: ${JSON.stringify({ type: 'done', summary: {
            fieldsExtracted: Object.entries(extraction.extractedData).filter(([, v]) => v !== null).length,
            confidence: extraction.confidence,
            grantsMatched: matchedOffers.length,
            pathRecalculated: !!freedomPath,
        } })}\n\n`);
        res.end();

    } catch (error) {
        console.error('[VisionExtract] Error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to process document. Please try a clearer screenshot.' })}\n\n`);
        res.end();
    }
});

/**
 * POST /api/simulator/debate
 * SSE endpoint for Hawk vs Dove debate
 */
router.post('/debate', async (req: Request, res: Response) => {
    const { question, hawkPosition, dovePosition } = req.body as {
        question: string;
        hawkPosition: string;
        dovePosition: string;
    };

    // Set SSE headers (X-Accel-Buffering required for Cloud Run streaming)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
        const user = getDemoUser();
        const model = getProModel();

        const userContext = `User has $${user.financials.totalDebt.toLocaleString()} in student loans across ${user.financials.loans.length} loans.
Loans: ${user.financials.loans.map(l => `$${l.balance.toLocaleString()} @ ${(l.rate * 100).toFixed(1)}% (${l.type})`).join(', ')}
Income: $${user.profile.job?.income?.toLocaleString() || '75,000'}/year`;

        // === SINGLE ROUND — each side makes their best case ===

        // Hawk's case
        const hawkPrompt = `You are THE HAWK — an aggressive financial strategist. Make your BEST 3-4 sentence case.

QUESTION: "${question}"
Position: ${hawkPosition}
USER: ${userContext}

Be specific with dollar amounts. Be direct and compelling.`;

        const hawkResult = await model.generateContentStream(hawkPrompt);
        let hawkResponse = '';
        for await (const chunk of hawkResult.stream) {
            const text = chunk.text();
            if (text) {
                hawkResponse += text;
                res.write(`data: ${JSON.stringify({ type: 'hawk', round: 1, text })}\n\n`);
            }
        }

        // Dove's case
        const dovePrompt = `You are THE DOVE — a patient financial strategist. Make your BEST 3-4 sentence rebuttal.

QUESTION: "${question}"
Position: ${dovePosition}
Hawk argued: ${hawkResponse}
USER: ${userContext}

Reference specific programs or policies. Be compelling.`;

        const doveResult = await model.generateContentStream(dovePrompt);
        let doveResponse = '';
        for await (const chunk of doveResult.stream) {
            const text = chunk.text();
            if (text) {
                doveResponse += text;
                res.write(`data: ${JSON.stringify({ type: 'dove', round: 1, text })}\n\n`);
            }
        }

        // === AI VERDICT — Immediately decide and allocate strategy ===
        res.write(`data: ${JSON.stringify({ type: 'judging' })}\n\n`);

        const verdictPrompt = `You are the JUDGE — a decisive financial AI. You heard both sides. Now CHOOSE the winner and allocate a repayment strategy.

QUESTION: "${question}"
HAWK argued: ${hawkResponse}
DOVE argued: ${doveResponse}
USER: ${userContext}

Pick a winner. Return ONLY valid JSON:
{
  "choice": "HAWK" or "DOVE",
  "winnerName": "The Hawk" or "The Dove",
  "confidence": 0.0 to 1.0,
  "ruling": "2-3 sentence decisive ruling explaining who wins and why, addressed to the borrower",
  "strategy": {
    "name": "short strategy name, e.g. 'Aggressive Payoff' or 'Patient Optimization'",
    "monthlyPayment": "$X,XXX",
    "timeline": "e.g. '18 months' or '3 years'",
    "steps": ["step 1", "step 2", "step 3", "step 4"]
  },
  "estimatedSavings": "$X,XXX"
}`;

        try {
            const verdictResult = await model.generateContent(verdictPrompt);
            const verdictText = verdictResult.response.text();
            const jsonMatch = verdictText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const verdict = JSON.parse(jsonMatch[0]);
                res.write(`data: ${JSON.stringify({ type: 'verdict', data: verdict })}\n\n`);

                // Emit bus event for debate verdict
                emitAgentEvent(
                    'debate:verdict',
                    'debate',
                    `${verdict.winnerName} wins (${Math.round((verdict.confidence || 0.75) * 100)}% confidence): ${verdict.strategy?.name || 'strategy decided'}`,
                    verdict,
                );
            }
        } catch (e) {
            res.write(`data: ${JSON.stringify({ type: 'verdict', data: {
                choice: 'HAWK',
                winnerName: 'The Hawk',
                confidence: 0.75,
                ruling: 'The math is clear: your 7.2% private loan is costing you guaranteed money every month. Paying it off aggressively saves more than any speculative strategy.',
                strategy: {
                    name: 'Aggressive Payoff',
                    monthlyPayment: '$850',
                    timeline: '18 months',
                    steps: ['Pay off $12K private loan first (7.2%)', 'Enroll federal loans in SAVE plan', 'Set up autopay for 0.25% reduction', 'Redirect freed payments to federal loans'],
                },
                estimatedSavings: '$4,800',
            } })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
    } catch (error) {
        console.error('[Debate] Error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to run debate' })}\n\n`);
        res.end();
    }
});

export default router;

