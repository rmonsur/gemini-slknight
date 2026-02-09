/**
 * freedomAgent.ts — Freedom Path Generator
 * 
 * The core "Reverse Engineer Your Freedom" feature.
 * Uses Gemini Pro to:
 * 1. Evaluate all available repayment strategies
 * 2. Identify the optimal strategy combination
 * 3. Generate the best-case outcome (debt-free date, savings, QoL)
 * 4. Work BACKWARD from that outcome to today
 * 5. Attach executable action items to the TODAY milestone
 */

import { getProModel } from '../config/gemini.js';
import { parseJSON } from '../utils/cleanJSON.js';
import type {
    UserRecord,
    FreedomPath,
    OptimalOutcome,
    Milestone,
    MilestoneAction,
    DecisionPoint,
    MazeBlueprint,
    MazeTile,
} from '../types/index.js';

// Opportunity database for the agent to reference
const OPPORTUNITY_DATABASE = `
AVAILABLE OPPORTUNITIES AND PROGRAMS:
1. Tulsa Remote Worker Grant: $10,000 for remote workers relocating to Tulsa, OK
2. Topeka Choose Topeka: $15,000 for remote workers, must rent or buy home
3. Northwest Arkansas Move to NWA: $10,000 + bike for remote workers
4. SAVE Plan: Income-driven repayment, 5% of discretionary income, 20-year forgiveness
5. PAYE Plan: 10% of discretionary income, 20-year forgiveness
6. PSLF: Full forgiveness after 120 payments while working for government/nonprofit
7. Autopay Discount: 0.25% rate reduction for enrolling in autopay
8. Refinancing: Private refinancing available for those with 700+ credit score
`;

// Build the Freedom Path prompt
const buildFreedomPrompt = (user: UserRecord, whatIf?: string): string => {
    const loansBreakdown = user.financials.loans
        .map(l => `  - ${l.type} loan: $${l.balance.toLocaleString()} @ ${(l.rate * 100).toFixed(2)}% (${l.servicerName || user.financials.servicer || 'Unknown servicer'})`)
        .join('\n');

    const monthlyIncome = user.profile.job?.income
        ? Math.round(user.profile.job.income / 12)
        : 6250; // Default estimate

    const whatIfClause = whatIf
        ? `\n\nWILDCARD SCENARIO: The user wants to explore: "${whatIf}"\nIncorporate this into your analysis and show how it changes the optimal path.\n`
        : '';

    return `You are the Freedom Path Architect — an AI that reverse-engineers the optimal path to debt freedom.

USER PROFILE:
- Name: ${user.profile.email?.split('@')[0] || 'Jane'}
- School: ${user.profile.school || 'Not specified'}
- Major: ${user.profile.major || 'Not specified'}
- Current Status: ${user.profile.status}
- Target City: ${user.profile.targetCity || 'Not specified'}
- Willing to Relocate: ${user.profile.willingnessToRelocate ? 'YES' : 'NO'}
- Employer Type: ${user.profile.job?.employerType || 'PRIVATE'}
- Monthly Income: $${monthlyIncome.toLocaleString()}
- Annual Income: $${user.profile.job?.income?.toLocaleString() || '75,000'}
- Family Size: ${user.profile.familySize}
- Lifestyle Preference: ${user.preferences.lifestylePreference}
- Risk Tolerance: ${user.preferences.riskTolerance}

CURRENT DEBT:
- Total: $${user.financials.totalDebt.toLocaleString()}
- Primary Servicer: ${user.financials.servicer || 'Unknown'}
- Loans:
${loansBreakdown}

${OPPORTUNITY_DATABASE}
${whatIfClause}

YOUR TASK:
1. Evaluate ALL available strategies: standard repayment, IDR plans (SAVE, PAYE, IBR), refinancing, aggressive payoff, relocation grants, PSLF eligibility
2. Identify the OPTIMAL combination of strategies for this specific user
3. Calculate the best-case outcome: earliest debt-free date, minimum interest paid, highest quality of life
4. Work BACKWARD from that outcome to TODAY, generating 5-8 milestones
5. For the TODAY milestone, generate 3-4 actionable steps with specific tools
6. Generate a MAZE BLUEPRINT — the gamified isometric representation of the user's freedom path

IMPORTANT: Start from the END (debt-free day) and work BACKWARD to today. Each milestone should feel like a step BACKWARD in time.

Generate JSON in this exact format:
{
  "optimalOutcome": {
    "debtFreeDate": "YYYY-MM-DD",
    "totalInterestPaid": <number>,
    "qualityOfLifeScore": <0-100>,
    "strategyName": "<name of combined strategy>",
    "narrativeSummary": "<2-3 sentences describing the victory moment>",
    "totalSaved": <dollars saved vs standard repayment>
  },
  "milestones": [
    {
      "id": "milestone_1",
      "date": "YYYY-MM-DD",
      "title": "<milestone title>",
      "narrative": "<2-3 sentences, personal and emotional>",
      "financialSnapshot": {
        "balance": <remaining debt>,
        "monthlyPayment": <payment at this point>
      },
      "decisionPoint": {
        "question": "<decision question if applicable>",
        "hawkPosition": "<aggressive strategy position>",
        "dovePosition": "<patient strategy position>"
      }
    }
  ],
  "mazeBlueprint": {
    "tiles": [
      {
        "milestoneId": "<matches a milestone id>",
        "tileType": "TODAY" | "DOCUMENT_SCAN" | "IDR_ENROLLMENT" | "REFINANCING" | "GRANT_APPLICATION" | "AGGRESSIVE_PAYOFF" | "PSLF" | "COACH" | "CALL_SERVICER" | "DEBT_FREE",
        "position": { "row": <0-7>, "col": <0 or 1> },
        "requiredTask": {
          "type": "DOCUMENT_SCANNER" | "LETTER_WRITER" | "CALL_SIMULATOR" | "HAWK_DOVE_DEBATE" | "COACH_CHAT" | "EXTERNAL_LINK" | "FUTURE_SELF" | "CALCULATOR",
          "instruction": "<personalized task instruction with real data>",
          "reason": "<why Gemini chose this task for this user>"
        },
        "unlocksNext": ["<next milestone id>"]
      }
    ],
    "reasoning": "<2-3 sentences explaining why you selected these tiles in this order for THIS specific borrower>",
    "totalTiles": <number of tiles>
  }
}

MAZE BLUEPRINT RULES:
1. SELECT only tiles relevant to THIS borrower. Not every tile type applies.
   - Only include PSLF if employer is GOVERNMENT or NON_PROFIT
   - Only include REFINANCING if borrowed has high-rate loans (>6%) where it makes sense
   - Only include GRANT_APPLICATION if the borrower is willing to relocate
   - Always include TODAY (row 6 or 7) and DEBT_FREE (row 0)
2. ORDER tiles by financial impact — highest-impact actions first after TODAY
3. ASSIGN a specific task to each tile, personalized with the borrower's ACTUAL DATA:
   - Use real servicer names: "${user.financials.servicer || 'Nelnet'}"
   - Use real rates and amounts from the loan breakdown
   - Use real program names and deadlines
4. POSITION tiles in a zigzag: TODAY at bottom (row 6, col 0), DEBT_FREE at top (row 0, col 0)
   - Rows decrease as you progress toward freedom (6 → 5 → 4 → ... → 0)
   - Columns alternate: 0, 1, 0, 1, 0, 1... (creates zigzag path)
5. The "reason" field should explain WHY this step matters for THIS borrower — not generic advice

The LAST milestone in the array should be "TODAY" (${new Date().toISOString().split('T')[0]}) with these actions:
{
  "id": "today",
  "date": "${new Date().toISOString().split('T')[0]}",
  "title": "Your Journey Begins",
  "narrative": "<inspiring call to action>",
  "financialSnapshot": { "balance": ${user.financials.totalDebt}, "monthlyPayment": <current or recommended> },
  "isToday": true,
  "actions": [
    {
      "id": "action_1",
      "title": "<action title>",
      "impact": "<e.g., 'Saves $137/year'>",
      "tool": "CALL_SIMULATOR" | "LETTER_WRITER" | "DOCUMENT_SCANNER" | "LINK" | "CALCULATOR",
      "toolData": { <relevant data for the tool> }
    }
  ]
}

Be specific with dates, dollar amounts, and program names. Make narratives emotionally resonant.
Include at least ONE milestone with a decisionPoint for the Hawk vs Dove debate feature.`;
};

// Build streaming narrative prompt
const buildNarrativePrompt = (user: UserRecord, whatIf?: string): string => {
    const whatIfClause = whatIf
        ? `The user is also exploring this scenario: "${whatIf}". Weave this into the narrative.`
        : '';

    return `You are writing a vivid, emotionally resonant narrative for a student loan borrower.

USER: ${user.profile.email?.split('@')[0] || 'Jane'}, ${user.profile.major || 'college graduate'} from ${user.profile.school || 'their university'}
DEBT: $${user.financials.totalDebt.toLocaleString()} in student loans
GOAL: Debt freedom while maintaining quality of life

${whatIfClause}

Write a 3-4 paragraph narrative that:
1. Opens with their VICTORY MOMENT — the day they make their last payment (be specific: describe the moment, the feeling, what they'll do to celebrate)
2. Works BACKWARD through key turning points that made this possible
3. Ends at TODAY — right now, this moment — and what they need to do first

Rules:
- Use second person ("You")
- Be specific with time references ("In August 2030...")
- Reference real programs if relevant (SAVE plan, PSLF, relocation grants)
- Make it emotional and personal — this is their story
- End with a direct call to action for TODAY

Begin:`;
};

// Fallback Freedom Path for demo/error cases
const getFallbackFreedomPath = (user: UserRecord): FreedomPath => {
    const today = new Date().toISOString().split('T')[0];

    return {
        optimalOutcome: {
            debtFreeDate: '2030-08-15',
            totalInterestPaid: 15800,
            qualityOfLifeScore: 78,
            strategyName: 'Tulsa Relocation + SAVE Plan + Aggressive Private Payoff',
            narrativeSummary: `You make your last payment on a quiet August morning in 2030. Four years ahead of schedule. The $10,000 Tulsa grant was the catalyst, but it was your discipline that made it real. You saved $12,200 in interest compared to the standard path.`,
            totalSaved: 12200,
        },
        milestones: [
            {
                id: 'milestone_victory',
                date: '2030-08-15',
                title: 'Debt Freedom Day',
                narrative: `The notification pings on your phone: "Final payment processed." You stare at the zero balance for a full minute before it sinks in. You're free. Four years of intentional choices led to this moment. Tonight, you're celebrating — and tomorrow, you're redirecting that $450 to your investment account.`,
                financialSnapshot: { balance: 0, monthlyPayment: 0 },
            },
            {
                id: 'milestone_4',
                date: '2029-03-01',
                title: 'Private Loan Eliminated',
                narrative: `The day you crushed your highest-interest debt. That 7.2% private loan haunted you for years — now it's gone. The remaining federal loans feel manageable. You can see the finish line.`,
                financialSnapshot: { balance: 18000, monthlyPayment: 380 },
                decisionPoint: {
                    question: 'Should you refinance the remaining federal loans or stay on SAVE?',
                    hawkPosition: 'Refinance to 4.5% fixed. Lock in guaranteed savings and a predictable payoff date.',
                    dovePosition: 'Stay on SAVE. Policy changes could mean forgiveness benefits you haven\'t considered.',
                },
            },
            {
                id: 'milestone_3',
                date: '2028-01-15',
                title: 'Crossed the Halfway Mark',
                narrative: `Looking at your loan dashboard, you realize you've paid off more than half. The compounding interest that scared you in 2026 is now working in your favor. Every extra payment hits principal directly.`,
                financialSnapshot: { balance: 27000, monthlyPayment: 450 },
            },
            {
                id: 'milestone_2',
                date: '2026-09-01',
                title: 'Tulsa Grant Deposited',
                narrative: `$10,000 lands in your account. Your first action: send it directly to your highest-interest loan. In one day, you've jumped 18 months ahead on your timeline. The move was scary, but this moment makes it worth it.`,
                financialSnapshot: { balance: 45000, monthlyPayment: 450 },
            },
            {
                id: 'milestone_1',
                date: '2026-06-01',
                title: 'Made the Decision to Relocate',
                narrative: `You hit submit on your Tulsa Remote application. Your hands are shaking. Brooklyn was comfortable, but comfortable wasn't getting you free. This is the moment you chose your future over your comfort zone.`,
                financialSnapshot: { balance: 54500, monthlyPayment: 450 },
            },
            {
                id: 'today',
                date: today,
                title: 'Your Journey Begins',
                narrative: `This is Day One. Right now, you have the power to change your trajectory. The path to August 2030 starts with a single action — and you can take it in the next 5 minutes.`,
                financialSnapshot: { balance: user.financials.totalDebt, monthlyPayment: 450 },
                isToday: true,
                actions: [
                    {
                        id: 'action_autopay',
                        title: 'Call servicer: Enroll in autopay',
                        impact: 'Saves $137/year (0.25% rate reduction)',
                        tool: 'CALL_SIMULATOR' as const,
                        toolData: { servicer: user.financials.servicer || 'Nelnet', objective: 'Enroll in autopay' },
                    },
                    {
                        id: 'action_tulsa',
                        title: 'Apply: Tulsa Remote Grant',
                        impact: '+$10,000 toward debt',
                        tool: 'LINK' as const,
                        toolData: { url: 'https://tulsaremote.com/apply/', deadline: '2026-03-31' },
                    },
                    {
                        id: 'action_scan',
                        title: 'Scan your loan statements',
                        impact: 'Improve path accuracy',
                        tool: 'DOCUMENT_SCANNER' as const,
                    },
                    {
                        id: 'action_save_letter',
                        title: 'Generate SAVE plan letter',
                        impact: 'Lower monthly payment',
                        tool: 'LETTER_WRITER' as const,
                        toolData: { letterType: 'SAVE_ENROLLMENT', servicer: user.financials.servicer || 'Nelnet' },
                    },
                ],
            },
        ],
        mazeBlueprint: {
            tiles: [
                {
                    milestoneId: 'today',
                    tileType: 'TODAY',
                    position: { row: 6, col: 0 },
                    requiredTask: {
                        type: 'DOCUMENT_SCANNER',
                        instruction: `Scan your ${user.financials.servicer || 'Nelnet'} loan statement to verify your exact rates`,
                        reason: 'We need accurate rate data to calculate if SAVE plan reduces your payment',
                    },
                    unlocksNext: ['milestone_1'],
                },
                {
                    milestoneId: 'milestone_1',
                    tileType: 'GRANT_APPLICATION',
                    position: { row: 5, col: 1 },
                    requiredTask: {
                        type: 'EXTERNAL_LINK',
                        instruction: 'Apply for the Tulsa Remote $10,000 grant',
                        reason: 'At your debt level, this grant jumps you 18 months ahead on your timeline',
                    },
                    unlocksNext: ['milestone_2'],
                },
                {
                    milestoneId: 'milestone_2',
                    tileType: 'IDR_ENROLLMENT',
                    position: { row: 4, col: 0 },
                    requiredTask: {
                        type: 'LETTER_WRITER',
                        instruction: 'Generate your SAVE plan enrollment letter',
                        reason: 'At your income, SAVE drops your payment significantly while keeping forgiveness options open',
                    },
                    unlocksNext: ['milestone_3'],
                },
                {
                    milestoneId: 'milestone_3',
                    tileType: 'CALL_SERVICER',
                    position: { row: 3, col: 1 },
                    requiredTask: {
                        type: 'CALL_SIMULATOR',
                        instruction: `Call ${user.financials.servicer || 'Nelnet'} to enroll in autopay`,
                        reason: 'Instant 0.25% rate reduction saves $137/year with zero effort',
                    },
                    unlocksNext: ['milestone_4'],
                },
                {
                    milestoneId: 'milestone_4',
                    tileType: 'REFINANCING',
                    position: { row: 2, col: 0 },
                    requiredTask: {
                        type: 'HAWK_DOVE_DEBATE',
                        instruction: 'Decide: Refinance remaining federal loans or stay on SAVE?',
                        reason: 'This is a pivotal decision — aggressive payoff vs policy protection',
                    },
                    unlocksNext: ['milestone_victory'],
                },
                {
                    milestoneId: 'milestone_victory',
                    tileType: 'DEBT_FREE',
                    position: { row: 0, col: 0 },
                    requiredTask: {
                        type: 'FUTURE_SELF',
                        instruction: 'Talk to your debt-free future self',
                        reason: 'See what freedom feels like. You earned this.',
                    },
                    unlocksNext: [],
                },
            ],
            reasoning: 'Starting with document scanning to verify rates, then Tulsa grant (highest immediate impact for relocate-willing borrowers), then SAVE enrollment, then autopay for instant savings, then the critical refinance decision, and finally freedom.',
            totalTiles: 6,
        },
        generatedAt: new Date().toISOString(),
    };
};

/**
 * Generate a complete Freedom Path (structured JSON)
 */
export const freedomAgent = async (
    user: UserRecord,
    whatIf?: string
): Promise<FreedomPath> => {
    try {
        const model = getProModel();
        const prompt = buildFreedomPrompt(user, whatIf);

        console.log('[FreedomAgent] Generating Freedom Path for user:', user.userId);

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        const fallback = getFallbackFreedomPath(user);

        const parsed = parseJSON<{
            optimalOutcome: OptimalOutcome;
            milestones: Milestone[];
            mazeBlueprint: MazeBlueprint;
        }>(
            responseText,
            {
                optimalOutcome: fallback.optimalOutcome,
                milestones: fallback.milestones,
                mazeBlueprint: fallback.mazeBlueprint,
            }
        );

        return {
            optimalOutcome: parsed.optimalOutcome,
            milestones: parsed.milestones,
            mazeBlueprint: parsed.mazeBlueprint,
            generatedAt: new Date().toISOString(),
        };
    } catch (error) {
        console.error('[FreedomAgent] Error:', error);
        // Return fallback for graceful degradation
        return getFallbackFreedomPath(user);
    }
};

/**
 * Stream the narrative hook text (for SSE endpoint)
 */
export async function* streamFreedomNarrative(
    user: UserRecord,
    whatIf?: string
): AsyncGenerator<string, void, unknown> {
    try {
        const model = getProModel();
        const prompt = buildNarrativePrompt(user, whatIf);

        console.log('[FreedomAgent] Streaming narrative for user:', user.userId);

        const result = await model.generateContentStream(prompt);

        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
                yield text;
            }
        }
    } catch (error) {
        console.error('[FreedomAgent] Streaming error:', error);
        // Yield fallback narrative
        yield `In August 2030, you make your final student loan payment. `;
        yield `The journey wasn't easy, but looking back, every sacrifice was worth it. `;
        yield `Today is where it all begins. Your first step: call your servicer and enroll in autopay. `;
        yield `That 0.25% rate reduction is free money — and it's waiting for you right now.`;
    }
}

export default freedomAgent;
