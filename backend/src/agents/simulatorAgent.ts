/**
 * simulatorAgent.ts — Life Architect (Stage 1)
 * 
 * Uses Gemini Pro for reasoning and scenario generation.
 * Generates:
 * - Design system (colors, fonts, mood) based on financial state
 * - 3 life scenarios (Status Quo, Optimization A, Optimization B)
 * - Matched offers from grant database
 */

import { getProModel } from '../config/gemini.js';
import { parseJSON } from '../utils/cleanJSON.js';
import type { UserRecord, AgentResponse, DesignSystem, Scenario, Offer } from '../types/index.js';

// Prompt template for the Life Architect
const buildPrompt = (user: UserRecord): string => `
You are the Life Architect, a financial AI that helps student loan borrowers visualize their future.

USER PROFILE:
- Name: Demo User (Jane)
- School: ${user.profile.school || 'Unknown'}
- Major: ${user.profile.major || 'Unknown'}
- Total Debt: $${user.financials.totalDebt.toLocaleString()}
- Monthly Income: $${user.profile.job?.income ? Math.round(user.profile.job.income / 12).toLocaleString() : 'Unknown'}
- Target City: ${user.profile.targetCity || 'Not specified'}
- Willing to Relocate: ${user.profile.willingnessToRelocate ? 'Yes' : 'No'}
- Lifestyle Preference: ${user.preferences.lifestylePreference}
- Risk Tolerance: ${user.preferences.riskTolerance}

LOANS:
${user.financials.loans.map(l => `- ${l.type}: $${l.balance.toLocaleString()} @ ${(l.rate * 100).toFixed(1)}%`).join('\n')}

Generate a JSON response with:
1. A "designSystem" object with colors/fonts that reflect their financial mood (hopeful = greens/blues, stressed = reds/oranges)
2. Three "scenarios" showing different life paths
3. Any matching "offers" for grants or programs

Response format:
{
  "designSystem": {
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "fontHeader": "font name",
    "fontBody": "font name",
    "mood": "OPTIMISTIC" | "NEUTRAL" | "CRISIS",
    "backgroundGradient": ["#hex1", "#hex2"]
  },
  "scenarios": [
    {
      "id": "unique_id",
      "label": "Scenario Name",
      "narrative": "2-3 sentence story of this future",
      "debtFreeDate": "YYYY-MM-DD",
      "monthlyPayment": number,
      "totalInterestPaid": number,
      "qualityOfLifeScore": 0-100,
      "chartData": {
        "labels": ["year1", "year2", ...],
        "balances": [balance1, balance2, ...]
      }
    }
  ],
  "offers": [
    {
      "id": "unique_id",
      "type": "RELOCATION_GRANT" | "REFINANCE" | "FORGIVENESS",
      "title": "Offer Name",
      "value": number,
      "source": "Source Name",
      "eligibility": "Brief eligibility description"
    }
  ]
}

Be creative with the narratives. Make them personal and emotionally resonant.
`;

// Default fallback response with full demo data
const fallbackResponse: AgentResponse = {
  success: true,
  designSystem: {
    primaryColor: '#6366F1',
    secondaryColor: '#1E1B4B',
    fontHeader: 'Inter',
    fontBody: 'Inter',
    mood: 'NEUTRAL',
    backgroundGradient: ['#1E1B4B', '#312E81'],
  },
  scenarios: [
    {
      id: 'status_quo',
      label: 'Standard Repayment',
      narrative: 'You continue on your current path with monthly payments of $450. You\'ll be debt-free in 10 years, but you\'ll pay $18,240 in interest. Your quality of life stays moderate, with limited ability to save for a home or invest.',
      debtFreeDate: '2036-01-15',
      monthlyPayment: 450,
      totalInterestPaid: 18240,
      qualityOfLifeScore: 55,
      chartData: {
        labels: ['2026', '2028', '2030', '2032', '2034', '2036'],
        balances: [43000, 35200, 26800, 17900, 8400, 0],
      },
    },
    {
      id: 'save_plan',
      label: 'SAVE Plan + Autopay',
      narrative: 'Switch to the SAVE income-driven plan and enable autopay for a 0.25% rate reduction. Your monthly payment drops to $166, freeing up $284/month for savings. After 20 years, any remaining balance is forgiven.',
      debtFreeDate: '2046-01-15',
      monthlyPayment: 166,
      totalInterestPaid: 8950,
      qualityOfLifeScore: 78,
      chartData: {
        labels: ['2026', '2030', '2034', '2038', '2042', '2046'],
        balances: [43000, 41200, 38100, 32400, 22100, 0],
      },
    },
    {
      id: 'tulsa_relocation',
      label: 'Tulsa Remote Grant',
      narrative: 'Move to Tulsa, Oklahoma and receive the $10,000 Tulsa Remote grant. Lower cost of living saves you $800/month. Apply those savings to aggressive debt payoff and become debt-free in just 4 years!',
      debtFreeDate: '2030-06-01',
      monthlyPayment: 850,
      totalInterestPaid: 6200,
      qualityOfLifeScore: 82,
      chartData: {
        labels: ['2026', '2027', '2028', '2029', '2030'],
        balances: [33000, 24200, 15100, 6800, 0],
      },
    },
  ],
  offers: [
    {
      id: 'tulsa_remote',
      type: 'RELOCATION_GRANT',
      title: 'Tulsa Remote Program',
      value: 10000,
      source: 'George Kaiser Family Foundation',
      eligibility: 'Remote workers willing to relocate to Tulsa, OK',
    },
    {
      id: 'save_enrollment',
      type: 'FORGIVENESS',
      title: 'SAVE Plan Enrollment',
      value: 0,
      source: 'Department of Education',
      eligibility: 'All federal loan borrowers',
    },
  ],
  message: 'Demo mode: showing sample scenarios',
};

/**
 * Main simulator agent function
 */
export const simulatorAgent = async (
  user: UserRecord,
  _input?: unknown
): Promise<AgentResponse> => {
  try {
    const model = getProModel();
    const prompt = buildPrompt(user);

    console.log('[SimulatorAgent] Generating scenarios for user:', user.userId);

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const parsed = parseJSON<{
      designSystem: DesignSystem;
      scenarios: Scenario[];
      offers: Offer[];
    }>(responseText, {
      designSystem: fallbackResponse.designSystem!,
      scenarios: [],
      offers: [],
    });

    return {
      success: true,
      designSystem: parsed.designSystem,
      scenarios: parsed.scenarios,
      offers: parsed.offers,
    };
  } catch (error) {
    console.error('[SimulatorAgent] Error:', error);

    // Return demo data on error for graceful degradation
    return {
      ...fallbackResponse,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export default simulatorAgent;
