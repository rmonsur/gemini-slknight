// PM2 Ecosystem config for Cloud Run deployment
// proxy (8080) → backend (3001) for /api/*, frontend (3000) for everything else
module.exports = {
    apps: [
        {
            name: 'proxy',
            script: './proxy.js',
            cwd: '/app',
            instances: 1,
            exec_mode: 'fork',
        },
        {
            name: 'backend',
            script: './backend/dist/server.js',
            cwd: '/app',
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production',
                PORT: 3001,
                GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
                DEMO_MODE_ENABLED: process.env.DEMO_MODE_ENABLED || 'true',
            },
        },
        {
            name: 'frontend',
            script: './frontend/server.js',
            cwd: '/app',
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
                HOSTNAME: '0.0.0.0',
            },
        },
    ],
};
