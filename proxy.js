/**
 * Lightweight reverse proxy for Cloud Run.
 * Listens on port 8080 (Cloud Run's exposed port).
 * Routes /api/* to Express backend (port 3001) with SSE streaming support.
 * Routes everything else to Next.js frontend (port 3000).
 */
const http = require('http');

const BACKEND = { host: '127.0.0.1', port: 3001 };
const FRONTEND = { host: '127.0.0.1', port: 3000 };

const server = http.createServer((clientReq, clientRes) => {
    const target = clientReq.url.startsWith('/api/') ? BACKEND : FRONTEND;

    const proxyReq = http.request(
        {
            hostname: target.host,
            port: target.port,
            path: clientReq.url,
            method: clientReq.method,
            headers: clientReq.headers,
        },
        (proxyRes) => {
            clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(clientRes, { end: true });
        },
    );

    proxyReq.on('error', (err) => {
        console.error(`[Proxy] Error forwarding to ${target.host}:${target.port}:`, err.message);
        if (!clientRes.headersSent) {
            clientRes.writeHead(502);
            clientRes.end('Bad Gateway');
        }
    });

    clientReq.pipe(proxyReq, { end: true });
});

server.listen(8080, '0.0.0.0', () => {
    console.log('[Proxy] Reverse proxy listening on port 8080');
    console.log('[Proxy] /api/* → backend:3001 | * → frontend:3000');
});
