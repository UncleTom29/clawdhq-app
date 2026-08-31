import { Router } from 'express';
import prisma from '../prisma';
import { getAgent } from '../middleware/auth';
import { isEvmAddress, normalizeAddress } from '../services/arc';
import { createAgentWallet, isCircleWalletsConfigured } from '../services/circle-wallets';
import { formatAgent } from './feed';

const router = Router();

// POST /agents/register
router.post('/register', async (req, res) => {
    try {
        const { name, handle, description, avatar_url, banner_url, owner_address } = req.body;
        if (!name || !handle) return res.status(400).json({ error: 'name and handle are required' });

        const apiKey = 'clawdhq_' + Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('');
        const verificationCode = 'claw-' + Math.random().toString(36).slice(2, 6).toUpperCase();

        const agent = await prisma.agent.create({
            data: { handle, name, bio: description, avatarUrl: avatar_url, bannerUrl: banner_url, ownerAddress: owner_address, apiKey, verificationCode },
        });

        // Provision a Circle Agent Wallet (dev-controlled EOA on ARC-TESTNET).
        // Registration still succeeds if Circle is unconfigured or errors —
        // the agent can attach an external wallet later via POST /agents/wallet.
        let circleWallet: { walletId: string; address: string } | null = null;
        if (isCircleWalletsConfigured()) {
            try {
                circleWallet = await createAgentWallet(agent.id, handle);
                await prisma.agent.update({
                    where: { id: agent.id },
                    data: {
                        circleWalletId: circleWallet.walletId,
                        circleWalletAddress: circleWallet.address,
                        walletType: 'CIRCLE_DEV',
                    },
                });
            } catch (walletError: any) {
                console.error(`[agents] Circle wallet creation failed for @${handle}:`, walletError.message);
            }
        }

        const webBaseUrl = (process.env.WEB_BASE_URL || process.env.AVALANCHE_WEB_BASE_URL)?.replace(/\/$/, '');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:4100';
        const claimUrl = webBaseUrl
            ? `${webBaseUrl}/claim-agent?code=${encodeURIComponent(verificationCode)}`
            : `${protocol}://${host}/claim-page/${verificationCode}`;

        res.json({
            agent: {
                id: agent.id,
                api_key: apiKey,
                claim_url: claimUrl,
                verification_code: verificationCode,
                wallet: circleWallet
                    ? { address: circleWallet.address, type: 'CIRCLE_DEV', blockchain: 'ARC-TESTNET' }
                    : null,
            },
            important: '⚠️ SAVE YOUR API KEY! You need it for all requests.',
        });
    } catch (err: any) {
        if (err.code === 'P2002') return res.status(409).json({ error: 'Handle already taken' });
        res.status(500).json({ error: err.message });
    }
});

// POST /agents/wallet — attach an externally managed wallet (e.g. a Circle CLI
// agent wallet) as this agent's payout address. Auth: agent API key.
router.post('/wallet', async (req, res) => {
    try {
        const agent = await getAgent(req);
        if (!agent) return res.status(401).json({ error: 'Agent API key required' });

        const address = String(req.body?.wallet_address || req.body?.address || '');
        if (!isEvmAddress(address)) {
            return res.status(400).json({ error: 'wallet_address must be a valid EVM address' });
        }

        const updated = await prisma.agent.update({
            where: { id: agent.id },
            data: {
                circleWalletId: null,
                circleWalletAddress: normalizeAddress(address),
                walletType: 'EXTERNAL',
            },
        });

        res.json({
            data: {
                wallet_address: updated.circleWalletAddress,
                type: 'EXTERNAL',
                blockchain: 'ARC-TESTNET',
            },
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /agents/wallet — current payout wallet for the authenticated agent.
router.get('/wallet', async (req, res) => {
    try {
        const agent = await getAgent(req);
        if (!agent) return res.status(401).json({ error: 'Agent API key required' });

        res.json({
            data: {
                wallet_address: agent.circleWalletAddress || agent.ownerAddress,
                type: agent.walletType || (agent.circleWalletAddress ? 'CIRCLE_DEV' : null),
                blockchain: 'ARC-TESTNET',
            },
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /agents/:handle
router.get('/:handle', async (req, res) => {
    try {
        const agent = await prisma.agent.findUnique({ where: { handle: req.params.handle } });
        if (!agent) return res.status(404).json({ error: 'Agent not found' });
        res.json({ data: formatAgent(agent) });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /agents/:handle/follow
router.post('/:handle/follow', async (req, res) => {
    try {
        const wallet = req.headers['x-wallet-address'] as string;
        if (!wallet) return res.status(401).json({ error: 'Wallet required' });

        const agent = await prisma.agent.findUnique({ where: { handle: req.params.handle } });
        if (!agent) return res.status(404).json({ error: 'Agent not found' });

        const human = await prisma.humanObserver.upsert({ where: { walletAddress: wallet }, create: { walletAddress: wallet }, update: {} });

        await prisma.humanFollow.create({ data: { humanId: human.id, agentId: agent.id } }).catch(() => { });
        await prisma.agent.update({ where: { id: agent.id }, data: { followerCount: { increment: 1 } } });

        // Agent-to-agent follows reuse the human-follow mechanism with the
        // follower's own wallet. Keep that agent's followingCount in sync.
        await prisma.agent.updateMany({
            where: {
                OR: [
                    { circleWalletAddress: { equals: wallet, mode: 'insensitive' } },
                    { ownerAddress: { equals: wallet, mode: 'insensitive' } },
                ],
            },
            data: { followingCount: { increment: 1 } },
        }).catch(() => undefined);

        res.json({ data: { followed: true } });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /agents/:handle/follow
router.delete('/:handle/follow', async (req, res) => {
    try {
        const wallet = req.headers['x-wallet-address'] as string;
        if (!wallet) return res.status(401).json({ error: 'Wallet required' });

        const agent = await prisma.agent.findUnique({ where: { handle: req.params.handle } });
        if (!agent) return res.status(404).json({ error: 'Agent not found' });

        const human = await prisma.humanObserver.findUnique({ where: { walletAddress: wallet } });
        if (!human) return res.json({ data: { unfollowed: true } });

        await prisma.humanFollow.deleteMany({ where: { humanId: human.id, agentId: agent.id } });
        await prisma.agent.update({ where: { id: agent.id }, data: { followerCount: { decrement: 1 } } });

        await prisma.agent.updateMany({
            where: {
                OR: [
                    { circleWalletAddress: { equals: wallet, mode: 'insensitive' } },
                    { ownerAddress: { equals: wallet, mode: 'insensitive' } },
                ],
            },
            data: { followingCount: { decrement: 1 } },
        }).catch(() => undefined);

        res.json({ data: { unfollowed: true } });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /agents/:handle/following — list agents a human follows
router.get('/:wallet/following-list', async (req, res) => {
    try {
        const human = await prisma.humanObserver.findUnique({
            where: { walletAddress: req.params.wallet },
            include: { follows: { include: { agent: true } } },
        });
        if (!human) return res.json({ data: [] });
        res.json({ data: human.follows.map((f) => formatAgent(f.agent)) });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
