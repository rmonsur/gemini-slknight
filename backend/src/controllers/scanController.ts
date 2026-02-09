/**
 * scanController.ts — API endpoints for Stage 3 (Auditor / Magic Mirror)
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { auditorAgent } from '../agents/auditorAgent.js';
import { getDemoUser, getDemoDocuments } from '../middleware/demoMode.js';

const router = Router();

// In-memory session storage (would be Firestore in production)
const scanSessions = new Map<string, {
    createdAt: Date;
    documents: unknown[];
    userId: string;
}>();

/**
 * POST /api/scan/session
 * Create a new QR session for cross-device upload
 */
router.post('/session', (_req: Request, res: Response) => {
    const sessionId = uuidv4();
    const user = getDemoUser();

    scanSessions.set(sessionId, {
        createdAt: new Date(),
        documents: [],
        userId: user.userId,
    });

    // Session URL for QR code
    const uploadUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/mobile-upload/${sessionId}`;

    res.json({
        success: true,
        sessionId,
        uploadUrl,
        expiresIn: 3600, // 1 hour
    });
});

/**
 * GET /api/scan/session/:sessionId
 * Get session status and documents
 */
router.get('/session/:sessionId', (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const session = scanSessions.get(sessionId);

    if (!session) {
        res.status(404).json({
            success: false,
            error: 'Session not found or expired',
        });
        return;
    }

    res.json({
        success: true,
        sessionId,
        documents: session.documents,
        createdAt: session.createdAt,
    });
});

/**
 * POST /api/scan/upload
 * Upload and process a document image
 */
router.post('/upload', async (req: Request, res: Response) => {
    try {
        const { sessionId, imageBase64, mimeType } = req.body as {
            sessionId: string;
            imageBase64: string;
            mimeType?: string;
        };

        if (!imageBase64) {
            res.status(400).json({
                success: false,
                error: 'No image data provided',
            });
            return;
        }

        const user = getDemoUser();

        // Process with Vision agent
        const result = await auditorAgent(user, {
            base64: imageBase64,
            mimeType: mimeType || 'image/jpeg',
        });

        // Store in session if provided
        if (sessionId && scanSessions.has(sessionId)) {
            const session = scanSessions.get(sessionId)!;
            session.documents.push({
                id: uuidv4(),
                uploadedAt: new Date().toISOString(),
                ...result,
            });
        }

        res.json({
            success: result.success,
            message: result.message,
            extractedData: result.extractedData,
        });
    } catch (error) {
        console.error('[ScanController] Upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process document',
        });
    }
});

/**
 * GET /api/scan/documents
 * Get all scanned documents for demo user
 */
router.get('/documents', (_req: Request, res: Response) => {
    const user = getDemoUser();

    if (user.isDemo) {
        res.json({
            success: true,
            documents: getDemoDocuments(),
        });
        return;
    }

    // For real users, would query Firestore
    res.json({
        success: true,
        documents: [],
    });
});

export default router;
