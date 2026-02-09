/**
 * optimizerController.ts — API endpoints for Stage 4 (Optimizer / Control Room)
 */

import { Router, Request, Response } from 'express';
import { watchdogAgent, OPPORTUNITY_DATABASE } from '../agents/watchdogAgent.js';
import { getDemoUser, getDemoOffers } from '../middleware/demoMode.js';

const router = Router();

/**
 * GET /api/optimizer/opportunities
 * Get matched opportunities for the user
 */
router.get('/opportunities', async (req: Request, res: Response) => {
    try {
        const user = getDemoUser();
        const forceRefresh = req.query.refresh === 'true';
        const allOpps = req.query.all === 'true';

        // Return full opportunity database for map display
        if (allOpps) {
            res.json({
                success: true,
                offers: OPPORTUNITY_DATABASE,
                message: `${OPPORTUNITY_DATABASE.length} opportunities available`,
            });
            return;
        }

        // For demo, return pre-computed offers unless refresh requested
        if (user.isDemo && !forceRefresh) {
            res.json({
                success: true,
                offers: getDemoOffers(),
                message: 'Using cached opportunity matches',
            });
            return;
        }

        // Call watchdog agent for fresh matches
        const response = await watchdogAgent(user);
        res.json(response);
    } catch (error) {
        console.error('[OptimizerController] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch opportunities',
        });
    }
});

/**
 * POST /api/optimizer/scenario
 * Calculate impact of toggling specific opportunities
 */
router.post('/scenario', (req: Request, res: Response) => {
    try {
        const { enabledOffers } = req.body as { enabledOffers: string[] };
        const user = getDemoUser();
        const allOffers = getDemoOffers() as Array<{ id: string; value: number; type: string }>;

        // Calculate total grant value from enabled offers
        const totalGrantValue = allOffers
            .filter(o => enabledOffers.includes(o.id))
            .reduce((sum, o) => sum + (o.value || 0), 0);

        // Simple projection: grants reduce debt directly
        const projectedDebt = Math.max(0, user.financials.totalDebt - totalGrantValue);

        // Estimate debt-free date shift (rough calculation)
        const monthsShaved = Math.round(totalGrantValue / 450); // Assuming $450/month payments
        const baseDebtFreeYear = 2036;
        const newDebtFreeYear = baseDebtFreeYear - Math.floor(monthsShaved / 12);

        res.json({
            success: true,
            scenario: {
                originalDebt: user.financials.totalDebt,
                projectedDebt,
                totalGrantValue,
                monthsShaved,
                debtFreeDate: `${newDebtFreeYear}-01-01`,
                enabledOffers,
            },
        });
    } catch (error) {
        console.error('[OptimizerController] Scenario error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate scenario',
        });
    }
});

/**
 * GET /api/optimizer/map-data
 * Get GeoJSON data for relocation map
 */
router.get('/map-data', (_req: Request, res: Response) => {
    // Use full opportunity database for rich map display
    const offers = OPPORTUNITY_DATABASE as Array<{
        id: string;
        title: string;
        value: number;
        type: string;
        coordinates?: [number, number];
        source: string;
    }>;

    // Convert offers with coordinates to GeoJSON
    const features = offers
        .filter(o => o.coordinates)
        .map(o => ({
            type: 'Feature' as const,
            properties: {
                id: o.id,
                title: o.title,
                value: o.value,
                type: o.type,
                source: o.source,
            },
            geometry: {
                type: 'Point' as const,
                coordinates: o.coordinates!,
            },
        }));

    res.json({
        success: true,
        geoJSON: {
            type: 'FeatureCollection',
            features,
        },
    });
});

export default router;
