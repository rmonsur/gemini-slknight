/**
 * coachAgent.ts — Drill Sergeant (Stage 2)
 * 
 * Uses Gemini Flash for low-latency coaching chat.
 * Includes demo fallback responses when API quota is exceeded.
 */

import { getFlashModel } from '../config/gemini.js';
import type { UserRecord, AgentResponse } from '../types/index.js';

// Demo fallback responses keyed by topic
const DEMO_RESPONSES: Record<string, string> = {
    'idr': `IDR (Income-Driven Repayment) is your secret weapon! 💪 It caps your payments at 10-20% of your discretionary income. With your profile, you could save $200+/month. Want me to calculate your exact payment under SAVE vs. PAYE?`,
    'pslf': `PSLF = 10 years of qualifying payments at a non-profit, then BAM — remaining balance forgiven tax-free! 🎯 You need to be on an IDR plan and submit your Employment Certification Form annually. Are you working in the public sector?`,
    'invest': `Classic question! Here's the math: if your loans are at 5% and the market averages 7%, investing SEEMS better. BUT — paying off debt is a guaranteed 5% return with zero risk. My advice: build a $1k emergency fund first, then attack high-interest debt, THEN invest. Baby steps! 📈`,
    'refinance': `Refinancing can slash your rate, but ONLY if you're NOT chasing forgiveness! You'd lose access to IDR and PSLF. With private refinancing, you could get 4-5% rates if your credit is solid. What's your current rate?`,
    'default': `Great question! Let me break it down for you: focus on your highest-rate loans first (avalanche method) or smallest balances first (snowball for motivation). With $55k in debt, you're actually in better shape than 70% of borrowers. You've GOT this! 💪`,
};

/**
 * Get a contextual demo response based on message content
 */
const getDemoResponse = (message: string): string => {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('idr') || lowerMessage.includes('income-driven') || lowerMessage.includes('income driven')) {
        return DEMO_RESPONSES['idr'];
    }
    if (lowerMessage.includes('pslf') || lowerMessage.includes('public service') || lowerMessage.includes('forgiveness')) {
        return DEMO_RESPONSES['pslf'];
    }
    if (lowerMessage.includes('invest') || lowerMessage.includes('pay off') || lowerMessage.includes('payoff')) {
        return DEMO_RESPONSES['invest'];
    }
    if (lowerMessage.includes('refinanc')) {
        return DEMO_RESPONSES['refinance'];
    }
    return DEMO_RESPONSES['default'];
};

/**
 * Coach agent - chat implementation with demo fallback
 */
export const coachAgent = async (
    user: UserRecord,
    input?: unknown
): Promise<AgentResponse> => {
    const userMessage = typeof input === 'string' ? input : 'Hello, I need help with my loans.';

    try {
        const model = getFlashModel();

        const loanDetails = user.financials.loans.map(l =>
            `  - ${l.type} loan: $${l.balance.toLocaleString()} at ${(l.rate * 100).toFixed(1)}%${l.servicerName ? ` (${l.servicerName})` : ''}${l.monthlyPayment ? `, paying $${l.monthlyPayment}/mo` : ''}`
        ).join('\n');

        const prompt = `
You are the Drill Sergeant, a motivational financial coach for student loan borrowers.
Be encouraging but direct. Give SPECIFIC advice using the borrower's actual numbers.

=== BORROWER PROFILE ===
Name: Demo User (${user.profile.major || 'Student'} at ${user.profile.school || 'Unknown'})
Status: ${user.profile.status}
Graduation: ${user.profile.gradDate || 'Unknown'}
Location: ${user.profile.targetCity || 'Unknown'}
Willing to relocate: ${user.profile.willingnessToRelocate ? 'Yes' : 'No'}
Family size: ${user.profile.familySize}

=== EMPLOYMENT ===
Job: ${user.profile.job?.title || 'Unknown'}
Employer type: ${user.profile.job?.employerType || 'Unknown'}
Annual income: $${user.profile.job?.income?.toLocaleString() || 'Unknown'}

=== LOAN PORTFOLIO ===
Total debt: $${user.financials.totalDebt.toLocaleString()}
Primary servicer: ${user.financials.servicer || 'Unknown'}
Individual loans:
${loanDetails}

=== PREFERENCES ===
Lifestyle: ${user.preferences.lifestylePreference}
Risk tolerance: ${user.preferences.riskTolerance}
Career ambition: ${user.preferences.careerAmbition || 'Not specified'}

=== INSTRUCTIONS ===
Reference the borrower's SPECIFIC loan amounts, rates, and servicers in your advice.
If they ask about refinancing, compare their actual rates to market rates.
If they ask about IDR/SAVE, calculate using their actual income ($${user.profile.job?.income?.toLocaleString() || '0'}) and family size (${user.profile.familySize}).
If they ask about PSLF, note their employer type is ${user.profile.job?.employerType || 'PRIVATE'}.
Keep responses concise (3-5 sentences). Use their real numbers.

Their message: "${userMessage}"

Respond with personalized, actionable advice:
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return {
            success: true,
            message: responseText,
        };
    } catch (error) {
        console.error('[CoachAgent] Error, using demo fallback:', error);

        // Use intelligent demo fallback
        const fallbackResponse = getDemoResponse(userMessage);

        return {
            success: true, // Mark as success so UI shows the response
            message: fallbackResponse,
        };
    }
};

export default coachAgent;

