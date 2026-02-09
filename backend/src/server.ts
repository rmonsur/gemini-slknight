import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { demoModeMiddleware } from './middleware/demoMode.js';
import simulatorController from './controllers/simulatorController.js';
import scanController from './controllers/scanController.js';
import optimizerController from './controllers/optimizerController.js';
import orchestratorController from './controllers/orchestratorController.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? true  // Allow all origins in production (proxied through Next.js)
        : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // Increased for image uploads
app.use(demoModeMiddleware);

// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        service: 'slknight-backend',
        timestamp: new Date().toISOString(),
        demoMode: process.env.DEMO_MODE_ENABLED === 'true',
    });
});

// API status
app.get('/api/v1/status', (_req, res) => {
    res.json({
        message: 'SLKnight API is running',
        version: '1.0.0',
        agents: ['simulator', 'coach', 'auditor', 'optimizer'],
        demoMode: process.env.DEMO_MODE_ENABLED === 'true',
    });
});

// Mount route controllers
app.use('/api/simulator', simulatorController);
app.use('/api/scan', scanController);
app.use('/api/optimizer', optimizerController);
app.use('/api/orchestrator', orchestratorController);

// Coach endpoint (simple, not a full controller)
app.post('/api/coach/chat', async (req, res) => {
    try {
        const { coachAgent } = await import('./agents/coachAgent.js');
        const { getDemoUser } = await import('./middleware/demoMode.js');

        const user = getDemoUser();
        const { message } = req.body as { message: string };

        const response = await coachAgent(user, message);
        res.json(response);
    } catch (error) {
        console.error('[CoachChat] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process chat message',
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🛡️  SLKnight Backend running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🎮 Demo mode: ${process.env.DEMO_MODE_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}`);
});

export default app;
