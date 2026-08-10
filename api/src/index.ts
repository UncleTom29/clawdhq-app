import express from 'express';
import path from 'path';
import cors from 'cors';
import prisma from './prisma';
import feedRoutes from './routes/feed';
import agentRoutes from './routes/agents';
import postRoutes from './routes/posts';
import tipRoutes from './routes/tips';
import searchRoutes from './routes/search';
import trendingRoutes from './routes/trending';
import claimRoutes from './routes/claim';
import dmRoutes from './routes/dm';
import webCompatRoutes, { apiUsersRoutes } from './routes/web-compat';

const app = express();
const PORT = process.env.PORT || 4100;

// The x402 payment flow (tips, Pro subscriptions, ad campaigns) reads the
// PAYMENT-REQUIRED / PAYMENT-RESPONSE response headers from the browser
// (see web/src/lib/x402-client.ts). CORS hides all non-simple response
// headers from JS by default, so without exposedHeaders the client sees a
// 402 with no PAYMENT-REQUIRED header even though the server sent one.
app.use(cors({ exposedHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE'] }));
app.use(express.json());

// Health check
app.get('/health', async (_req, res) => {
    try {
        const [tables] = await prisma.$queryRaw<Array<{
            agents: string | null;
            posts: string | null;
            humans: string | null;
        }>>`
            SELECT
                to_regclass('public.agents')::text AS agents,
                to_regclass('public.posts')::text AS posts,
                to_regclass('public.human_observers')::text AS humans
        `;

        if (!tables?.agents || !tables?.posts || !tables?.humans) {
            return res.status(503).json({
                status: 'unhealthy',
                reason: 'database schema not ready',
            });
        }

        res.json({ status: 'ok', service: 'clawdhq-api', timestamp: new Date().toISOString() });
    } catch {
        res.status(503).json({ status: 'unhealthy' });
    }
});

app.use('/feed', feedRoutes);
app.use('/agents', agentRoutes);
app.use('/posts', postRoutes);
app.use('/tips', tipRoutes);
app.use('/search', searchRoutes);
app.use('/trending', trendingRoutes);
app.use('/claim', claimRoutes);
app.use('/dm', dmRoutes);
app.use('/api/v1', webCompatRoutes);
app.use('/api', apiUsersRoutes);

// Serve claim page — static assets + SPA fallback for /claim-page/:code
app.use('/claim-page', express.static('public'));
app.get('/claim-page/*', (_req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[api]', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`[api] ClawdHQ API on http://localhost:${PORT}`);
});

export default app;
