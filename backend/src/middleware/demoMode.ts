/**
 * demoMode.ts — Demo mode middleware
 * 
 * Intercepts requests and provides seeded demo data for hackathon judges.
 * Demo mode is enabled by default, no login required.
 */

import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import type { UserRecord } from '../types/index.js';

// Load demo user data from JSON file
const demoUserPath = path.join(__dirname, '..', 'seed', 'demoUser.json');
const demoUserData = JSON.parse(fs.readFileSync(demoUserPath, 'utf-8'));

// Type the demo user data
const demoUser = demoUserData as UserRecord & {
    preComputedScenarios: Record<string, unknown>;
    preComputedOffers: unknown[];
    preScannedDocuments: unknown[];
};

// Check if demo mode is enabled
const isDemoMode = (): boolean => {
    return process.env.DEMO_MODE_ENABLED === 'true';
};

// Demo user ID constant
export const DEMO_USER_ID = 'demo_jane_doe_001';

/**
 * Middleware to attach demo user to request
 */
export const demoModeMiddleware = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    if (isDemoMode()) {
        // Attach demo user to request for easy access
        (req as Request & { demoUser: typeof demoUser }).demoUser = demoUser;
        (req as Request & { isDemo: boolean }).isDemo = true;
    }
    next();
};

/**
 * Get the demo user record
 */
export const getDemoUser = (): UserRecord => {
    return {
        userId: demoUser.userId,
        lifecycleStage: demoUser.lifecycleStage,
        isDemo: demoUser.isDemo,
        profile: demoUser.profile,
        financials: demoUser.financials,
        preferences: demoUser.preferences,
        generativeState: demoUser.generativeState,
        notifications: demoUser.notifications,
        createdAt: demoUser.createdAt,
        updatedAt: demoUser.updatedAt,
    };
};

/**
 * Get pre-computed demo scenarios (no API call needed)
 */
export const getDemoScenarios = () => demoUser.preComputedScenarios;

/**
 * Get pre-computed demo offers
 */
export const getDemoOffers = () => demoUser.preComputedOffers;

/**
 * Get pre-scanned demo documents
 */
export const getDemoDocuments = () => demoUser.preScannedDocuments;

/**
 * Update demo user lifecycle stage (in-memory only)
 */
export const setDemoUserStage = (stage: UserRecord['lifecycleStage']): void => {
    demoUser.lifecycleStage = stage;
};

export default demoModeMiddleware;
