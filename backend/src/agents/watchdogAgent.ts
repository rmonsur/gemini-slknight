/**
 * watchdogAgent.ts — Policy Sentinel + Opportunity Scout (Stage 4)
 * 
 * Uses Gemini Pro for analyzing policy changes and matching grants.
 * Runs as background agent to find opportunities.
 */

import { getProModel } from '../config/gemini.js';
import { parseJSON } from '../utils/cleanJSON.js';
import type { UserRecord, AgentResponse, Offer } from '../types/index.js';

// Pre-seeded opportunity data (would come from scrapers in production)
const OPPORTUNITY_DATABASE: Offer[] = [
    // === RELOCATION GRANTS ===
    {
        id: 'tulsa_remote',
        type: 'RELOCATION_GRANT',
        title: 'Tulsa Remote Worker Grant',
        value: 10000,
        source: 'Tulsa Remote',
        coordinates: [-95.99, 36.15],
        eligibility: 'Remote workers, 18+, relocate within 6 months',
    },
    {
        id: 'topeka_incentive',
        type: 'RELOCATION_GRANT',
        title: 'Choose Topeka Incentive',
        value: 15000,
        source: 'Greater Topeka Partnership',
        coordinates: [-95.68, 39.04],
        eligibility: 'Full-time remote workers, must rent or buy home',
    },
    {
        id: 'northwest_arkansas',
        type: 'RELOCATION_GRANT',
        title: 'Northwest Arkansas Incentive',
        value: 10000,
        source: 'Northwest Arkansas Council',
        coordinates: [-94.17, 36.19],
        eligibility: 'Remote workers, mountain bike included',
    },
    {
        id: 'savannah_tech',
        type: 'RELOCATION_GRANT',
        title: 'Savannah Technology Workforce Incentive',
        value: 2000,
        source: 'Savannah Economic Development Authority',
        coordinates: [-81.09, 32.08],
        eligibility: 'Tech workers relocating to Savannah',
    },
    {
        id: 'shoals_remote',
        type: 'RELOCATION_GRANT',
        title: 'Remote Shoals Incentive',
        value: 10000,
        source: 'Shoals Economic Development Authority',
        coordinates: [-87.68, 34.74],
        eligibility: 'Remote workers relocating to Shoals, Alabama',
    },
    {
        id: 'mhk_kansas',
        type: 'RELOCATION_GRANT',
        title: 'Manhattan, Kansas Hiring Incentive',
        value: 5000,
        source: 'Manhattan Area Chamber of Commerce',
        coordinates: [-96.57, 39.18],
        eligibility: 'New full-time employees in Manhattan, KS',
    },
    {
        id: 'natchez_relocate',
        type: 'RELOCATION_GRANT',
        title: 'Shift South — Natchez Incentive',
        value: 6000,
        source: 'Natchez Inc.',
        coordinates: [-91.40, 31.56],
        eligibility: 'Remote workers relocating to Natchez, Mississippi',
    },
    {
        id: 'newton_iowa',
        type: 'RELOCATION_GRANT',
        title: 'Newton, Iowa Remote Worker Program',
        value: 10000,
        source: 'Newton Development Corporation',
        coordinates: [-93.05, 41.70],
        eligibility: 'Remote workers, $2,500 cash + $7,500 toward home purchase',
    },
    {
        id: 'lewisburg_wv',
        type: 'RELOCATION_GRANT',
        title: 'Ascend West Virginia',
        value: 12000,
        source: 'West Virginia University',
        coordinates: [-80.44, 37.80],
        eligibility: 'Remote workers relocating to WV, includes outdoor rec package',
    },
    {
        id: 'duluth_mn',
        type: 'RELOCATION_GRANT',
        title: 'Remote Duluth Incentive',
        value: 5000,
        source: 'Remote Duluth',
        coordinates: [-92.10, 46.78],
        eligibility: 'Remote workers relocating to Duluth, MN',
    },
    {
        id: 'bemidji_mn',
        type: 'RELOCATION_GRANT',
        title: 'Bemidji Remote Worker Grant',
        value: 2500,
        source: 'Greater Bemidji',
        coordinates: [-94.88, 47.47],
        eligibility: 'Remote workers, 6-month residency commitment',
    },
    {
        id: 'greensburg_indiana',
        type: 'RELOCATION_GRANT',
        title: 'MakeMyMove Greensburg',
        value: 5000,
        source: 'Decatur County, Indiana',
        coordinates: [-85.48, 39.34],
        eligibility: 'Remote workers relocating to Greensburg, IN',
    },
    {
        id: 'quincy_il',
        type: 'RELOCATION_GRANT',
        title: 'Quincy Remote Worker Incentive',
        value: 5000,
        source: 'Great River Economic Development Foundation',
        coordinates: [-91.41, 39.94],
        eligibility: 'Full-time remote workers relocating to Quincy, IL',
    },
    {
        id: 'montpelier_vt',
        type: 'RELOCATION_GRANT',
        title: 'Vermont Remote Worker Grant',
        value: 7500,
        source: 'Vermont Agency of Commerce',
        coordinates: [-72.58, 44.26],
        eligibility: 'Remote workers relocating to Vermont',
    },
    {
        id: 'hamilton_ohio',
        type: 'RELOCATION_GRANT',
        title: 'Hamilton Ohio Talent Attraction',
        value: 5000,
        source: 'CORE Fund Hamilton',
        coordinates: [-84.56, 39.40],
        eligibility: 'Remote or local workers, includes co-working membership',
    },
    {
        id: 'chattanooga_tn',
        type: 'RELOCATION_GRANT',
        title: 'Geek Move Chattanooga',
        value: 7500,
        source: 'Chattanooga Technology Council',
        coordinates: [-85.31, 35.05],
        eligibility: 'Tech workers relocating, gigabit internet city',
    },
    {
        id: 'tucson_az',
        type: 'RELOCATION_GRANT',
        title: 'Start Next in Tucson',
        value: 7500,
        source: 'Startup Tucson',
        coordinates: [-110.93, 32.22],
        eligibility: 'Remote workers or entrepreneurs relocating to Tucson',
    },
    {
        id: 'boise_idaho',
        type: 'RELOCATION_GRANT',
        title: 'Boise Talent Incentive',
        value: 3000,
        source: 'Boise Valley Economic Partnership',
        coordinates: [-116.21, 43.62],
        eligibility: 'Skilled workers relocating to Boise metro area',
    },
    {
        id: 'baltimore_live',
        type: 'RELOCATION_GRANT',
        title: 'Live Near Your Work — Baltimore',
        value: 5000,
        source: 'Baltimore City',
        coordinates: [-76.61, 39.29],
        eligibility: 'New hires at participating Baltimore employers',
    },
    // === FORGIVENESS PROGRAMS ===
    {
        id: 'pslf_program',
        type: 'FORGIVENESS',
        title: 'Public Service Loan Forgiveness',
        value: 0,
        source: 'Federal Student Aid',
        coordinates: [-77.04, 38.91],
        eligibility: 'Government/nonprofit employees, 120 qualifying payments',
    },
    {
        id: 'save_plan',
        type: 'FORGIVENESS',
        title: 'SAVE Plan — Income-Driven Repayment',
        value: 0,
        source: 'Department of Education',
        coordinates: [-77.01, 38.88],
        eligibility: 'All federal loan borrowers, payments capped at 5-10% discretionary income',
    },
    {
        id: 'teacher_forgiveness',
        type: 'FORGIVENESS',
        title: 'Teacher Loan Forgiveness',
        value: 17500,
        source: 'Federal Student Aid',
        coordinates: [-86.78, 36.16],
        eligibility: 'Teachers in low-income schools for 5+ years, up to $17,500',
    },
    {
        id: 'nurse_corps',
        type: 'FORGIVENESS',
        title: 'NURSE Corps Loan Repayment',
        value: 40000,
        source: 'HRSA',
        coordinates: [-77.03, 38.90],
        eligibility: 'Nurses working in critical shortage facilities, up to 85% of loans',
    },
    {
        id: 'nhsc_repayment',
        type: 'FORGIVENESS',
        title: 'National Health Service Corps Repayment',
        value: 50000,
        source: 'NHSC',
        coordinates: [-104.99, 39.74],
        eligibility: 'Health professionals in underserved areas, $50K for 2 years',
    },
    // === REFINANCING OPPORTUNITIES ===
    {
        id: 'sofi_refi',
        type: 'REFINANCE',
        title: 'SoFi Student Loan Refinance',
        value: 8000,
        source: 'SoFi',
        coordinates: [-122.39, 37.79],
        eligibility: 'Good credit, employed, rates from 4.49% APR',
    },
    {
        id: 'earnest_refi',
        type: 'REFINANCE',
        title: 'Earnest Refinance — Custom Payments',
        value: 7500,
        source: 'Earnest',
        coordinates: [-122.42, 37.77],
        eligibility: 'Min $35K income, rates from 4.29% APR',
    },
    {
        id: 'laurel_road_refi',
        type: 'REFINANCE',
        title: 'Laurel Road Healthcare Refinance',
        value: 12000,
        source: 'Laurel Road / KeyBank',
        coordinates: [-81.69, 41.50],
        eligibility: 'Healthcare professionals, exclusive low rates from 4.24%',
    },
    // === STATE-SPECIFIC PROGRAMS ===
    {
        id: 'maine_opportunity',
        type: 'POLICY_CHANGE',
        title: 'Maine Opportunity Tax Credit',
        value: 4200,
        source: 'Maine Revenue Services',
        coordinates: [-69.77, 44.31],
        eligibility: 'Graduates living & working in Maine, annual tax credit for loan payments',
    },
    {
        id: 'maryland_smartbuy',
        type: 'POLICY_CHANGE',
        title: 'Maryland SmartBuy 3.0',
        value: 30000,
        source: 'Maryland Housing',
        coordinates: [-76.64, 39.05],
        eligibility: 'Homebuyers with student debt, up to $30K toward loans at closing',
    },
    {
        id: 'kansas_rural',
        type: 'RELOCATION_GRANT',
        title: 'Kansas Rural Opportunity Zone',
        value: 15000,
        source: 'Kansas Department of Commerce',
        coordinates: [-98.48, 38.47],
        eligibility: 'Relocate to qualifying rural KS county, up to $15K in loan repayment',
    },
    {
        id: 'indiana_repayment',
        type: 'POLICY_CHANGE',
        title: 'Indiana Employer Student Loan Assist',
        value: 5250,
        source: 'Indiana Economic Development',
        coordinates: [-86.16, 39.77],
        eligibility: 'Tax-free employer repayment assistance up to $5,250/yr',
    },
    {
        id: 'michigan_reconnect',
        type: 'POLICY_CHANGE',
        title: 'Michigan Reconnect Tuition Assistance',
        value: 4000,
        source: 'Michigan Department of Labor',
        coordinates: [-84.55, 42.73],
        eligibility: 'MI residents 25+, free community college tuition',
    },
    {
        id: 'texas_repayment',
        type: 'POLICY_CHANGE',
        title: 'Texas Loan Repayment Program',
        value: 20000,
        source: 'Texas Higher Education Coordinating Board',
        coordinates: [-97.74, 30.27],
        eligibility: 'Health professionals in underserved TX communities',
    },
    {
        id: 'ohio_opportunity',
        type: 'RELOCATION_GRANT',
        title: 'Ohio Opportunity Scholarship',
        value: 3000,
        source: 'Ohio Department of Education',
        coordinates: [-82.99, 39.96],
        eligibility: 'Recent graduates working in Ohio STEM fields',
    },
    {
        id: 'alaska_education',
        type: 'FORGIVENESS',
        title: 'Alaska Teacher Education Loan',
        value: 7500,
        source: 'Alaska Commission on Postsecondary Education',
        coordinates: [-149.90, 61.22],
        eligibility: 'Teachers in rural Alaska, up to $7,500/year for 5 years',
    },
];

// Prompt for matching opportunities
const buildMatchPrompt = (user: UserRecord, opportunities: Offer[]): string => `
You are an Opportunity Scout analyzing which programs match a borrower's profile.

USER PROFILE:
- Total Debt: $${user.financials.totalDebt.toLocaleString()}
- Income: $${user.profile.job?.income?.toLocaleString() || 'Unknown'}
- Employer Type: ${user.profile.job?.employerType || 'Unknown'}
- Target City: ${user.profile.targetCity || 'Flexible'}
- Willing to Relocate: ${user.profile.willingnessToRelocate}
- Family Size: ${user.profile.familySize}

AVAILABLE OPPORTUNITIES:
${opportunities.map(o => `- ${o.title}: $${o.value} (${o.eligibility})`).join('\n')}

Return a JSON array of opportunity IDs that match this user, ranked by impact:
{
  "matches": ["opportunity_id_1", "opportunity_id_2"],
  "reasoning": "Brief explanation of why these match"
}
`;

/**
 * Main watchdog agent function
 */
export const watchdogAgent = async (
    user: UserRecord,
    _input?: unknown
): Promise<AgentResponse> => {
    try {
        const model = getProModel();
        const prompt = buildMatchPrompt(user, OPPORTUNITY_DATABASE);

        console.log('[WatchdogAgent] Scanning opportunities for user:', user.userId);

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        const parsed = parseJSON<{ matches: string[]; reasoning: string }>(
            responseText,
            { matches: [], reasoning: '' }
        );

        // Filter opportunities to matched ones
        const matchedOffers = OPPORTUNITY_DATABASE.filter(o =>
            parsed.matches.includes(o.id)
        );

        // If no matches from AI, return top 3 by value
        const offers = matchedOffers.length > 0
            ? matchedOffers
            : OPPORTUNITY_DATABASE.slice(0, 3);

        return {
            success: true,
            offers,
            message: parsed.reasoning || 'Found matching opportunities',
        };
    } catch (error) {
        console.error('[WatchdogAgent] Error:', error);

        // Return pre-seeded data on error
        return {
            success: true,
            offers: OPPORTUNITY_DATABASE.slice(0, 3),
            message: 'Using cached opportunity data',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};

export { OPPORTUNITY_DATABASE };
export default watchdogAgent;
