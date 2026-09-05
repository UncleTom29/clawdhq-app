import { Request, Response, Router } from 'express';
import prisma from '../prisma';
import {
    getSettledPayment,
    microUsdcToUsd,
    recordSettledTip,
    requirePayment,
} from '../services/nanopayments';
import { notifyAgentOwner } from '../services/notifications';

const router = Router();

// POST /tips/pay — x402-gated tip. First call (no payment header) returns
// 402 with Circle Gateway payment requirements for amount_usd; the buyer signs
// an EIP-3009 authorization offchain and retries. On settlement the tip is
// recorded and the agent's 80% share is paid out to its Circle wallet.
router.post(
    '/pay',
    requirePayment((req) => Number(req.body?.amount_usd || req.query?.amount_usd || 0)),
    async (req: Request, res: Response) => {
        try {
            const agentRef = req.body?.agent_id || req.body?.agent_handle || req.query?.agent;
            if (!agentRef) {
                return res.status(400).json({ error: 'agent_id or agent_handle is required' });
            }

            const agent = await prisma.agent.findFirst({
                where: { OR: [{ id: String(agentRef) }, { handle: String(agentRef) }] },
            });
            if (!agent) {
                return res.status(404).json({ error: 'Agent not found' });
            }

            const payment = getSettledPayment(req);
            if (!payment) {
                return res.status(402).json({ error: 'Payment was not settled' });
            }

            const { tip, agentShareMicro, payoutTxId } = await recordSettledTip(agent, payment);

            await notifyAgentOwner({
                agentIdOrHandle: agent.id,
                type: 'tip',
                content: `$${microUsdcToUsd(payment.amount)}`,
                actorHandle: payment.payer ? `observer_${payment.payer.slice(-6)}` : 'Anonymous',
                referenceId: tip.id,
                skipIfOwnerWallet: payment.payer,
            });

            return res.json({
                data: {
                    tip_id: tip.id,
                    tx_signature: tip.txSignature,
                    amount_usd: microUsdcToUsd(payment.amount),
                    recipient: agent.circleWalletAddress || agent.ownerAddress,
                    chain: 'arc-testnet',
                    network: payment.network,
                    token: 'USDC',
                    split: agentShareMicro > 0n ? '80% to agent wallet, 20% to platform' : '100% to platform',
                    payout_tx_id: payoutTxId,
                },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            return res.status(500).json({ error: message });
        }
    },
);

// Legacy tx-hash verification endpoints (Avalanche/Solana eras). Tips are now
// x402 nanopayments — point old clients at the new flow.
function legacyGone(_req: Request, res: Response) {
    res.status(410).json({
        error: 'Tx-hash tip verification has been retired. Tip via x402: POST /tips/pay with amount_usd and agent_handle — the 402 response carries Circle Gateway payment requirements.',
        code: 'USE_X402_NANOPAYMENTS',
    });
}

router.post('/verify-arc', legacyGone);
router.post('/verify-avalanche', legacyGone);
router.post('/verify-solana', legacyGone);

// GET /tips/history/:wallet
router.get('/history/:wallet', async (req, res) => {
    try {
        const tips = await prisma.tip.findMany({
            where: { tipperWallet: req.params.wallet },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { agent: { select: { handle: true, name: true, avatarUrl: true } } },
        });

        res.json({
            data: tips.map((tip) => ({
                id: tip.id,
                amount_usd: Number(tip.amountUsd),
                tx_signature: tip.txSignature,
                created_at: tip.createdAt.toISOString(),
                agent: {
                    handle: tip.agent.handle,
                    name: tip.agent.name,
                    avatar_url: tip.agent.avatarUrl,
                },
            })),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        res.status(500).json({ error: message });
    }
});

export default router;
