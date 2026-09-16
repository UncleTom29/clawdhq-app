// Circle Agent Nanopayments (x402 + Gateway) — the payment rail for ClawdHQ.
//
// Tips, Pro subscriptions, and ad campaigns are all paid as gasless USDC
// nanopayments: the route responds 402 with Gateway payment requirements, the
// buyer signs an EIP-3009 authorization offchain and retries, and Circle
// Gateway batches authorizations into onchain settlements. The x402 seller is
// the platform treasury (Circle developer-controlled wallet on Arc Testnet).
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server';
import prisma from '../prisma';
import { getTreasuryAddress, isCircleWalletsConfigured, transferUsdcFromTreasury } from './circle-wallets';

export const GATEWAY_FACILITATOR_URL =
    process.env.GATEWAY_FACILITATOR_URL ||
    (process.env.ARC_CHAIN_ID === '5042002'
        ? 'https://gateway-api-testnet.circle.com'
        : 'https://gateway-api.circle.com');
export const ARC_CAIP2 =
    process.env.ARC_CAIP2 ||
    (process.env.ARC_CHAIN_ID === '5042002' ? 'eip155:5042002' : 'eip155:5042');
export const ARC_TESTNET_CAIP2 = 'eip155:5042002';

export interface SettledPayment {
    payer: string;
    // USDC atomic units (6 decimals).
    amount: string;
    network: string;
    transaction?: string;
}

type GatewayMiddleware = ReturnType<typeof createGatewayMiddleware>;

let cachedGateway: GatewayMiddleware | null = null;
let cachedSellerAddress: string | null = null;

function getGateway(): GatewayMiddleware | null {
    const sellerAddress = getTreasuryAddress();
    if (!sellerAddress) {
        return null;
    }

    if (!cachedGateway || cachedSellerAddress !== sellerAddress) {
        const networks = process.env.GATEWAY_NETWORKS
            ? process.env.GATEWAY_NETWORKS.split(',').map((network) => network.trim())
            : undefined; // Accept all Gateway-supported networks by default.

        cachedGateway = createGatewayMiddleware({
            sellerAddress,
            facilitatorUrl: GATEWAY_FACILITATOR_URL,
            networks,
            description: 'ClawdHQ payments (tips, Pro subscriptions, ad campaigns)',
        });
        cachedSellerAddress = sellerAddress;
    }

    return cachedGateway;
}

export function isNanopaymentsConfigured() {
    return !!getTreasuryAddress();
}

function clampPrice(amountUsd: number): string | null {
    if (!Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > 100_000) {
        return null;
    }

    return `$${amountUsd.toFixed(6)}`;
}

// Express middleware factory with per-request pricing. The resolved price must
// be derivable from the request alone (body/params/query) so the 402 challenge
// and the paid retry price the same amount.
export function requirePayment(getAmountUsd: (req: Request) => number) {
    return (req: Request, res: Response, next: NextFunction) => {
        const gateway = getGateway();
        if (!gateway) {
            return res.status(503).json({
                error: {
                    code: 'PAYMENTS_NOT_CONFIGURED',
                    message:
                        'Nanopayments are not configured. Set CIRCLE_API_KEY/CIRCLE_ENTITY_SECRET (or GATEWAY_SELLER_ADDRESS).',
                },
            });
        }

        const price = clampPrice(getAmountUsd(req));
        if (!price) {
            return res.status(400).json({
                error: { code: 'BAD_AMOUNT', message: 'A positive USD amount is required.' },
            });
        }

        return gateway.require(price)(req as any, res as any, next);
    };
}

// Reads the settled payment the Gateway middleware attached to the request.
export function getSettledPayment(req: Request): SettledPayment | null {
    const payment = (req as any).payment as
        | { verified: boolean; payer: string; amount: string; network: string; transaction?: string }
        | undefined;

    if (!payment?.verified) {
        return null;
    }

    return {
        payer: payment.payer,
        amount: payment.amount,
        network: payment.network,
        transaction: payment.transaction,
    };
}

export function microUsdcToUsd(amountMicro: string): number {
    return Number(amountMicro) / 1_000_000;
}

export function usdToUsdcString(amountUsd: number): string {
    return amountUsd.toFixed(6);
}

const AGENT_TIP_SHARE_BPS = 8000n;
const PRO_MONTHLY_PRICE_USDC = Number(process.env.PRO_MONTHLY_PRICE_USDC || '4.99');
const SUBSCRIPTION_MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;

function settlementRef(payment: SettledPayment) {
    return payment.transaction || `gw_${randomUUID()}`;
}

// Records a settled tip nanopayment: Tip row, agent earnings (80% share, in
// cents), and a treasury → agent-wallet USDC payout of the agent share.
// The payout is best-effort — the buyer's payment has already settled, so a
// payout failure must not fail the request; it is logged for reconciliation.
export async function recordSettledTip(agent: {
    id: string;
    circleWalletAddress?: string | null;
    ownerAddress?: string | null;
}, payment: SettledPayment) {
    const txSignature = settlementRef(payment);
    const amountMicro = BigInt(payment.amount);
    const agentShareMicro = (amountMicro * AGENT_TIP_SHARE_BPS) / 10000n;
    const agentShareCents = Number(agentShareMicro / 10000n);

    const existingTip = await prisma.tip.findUnique({ where: { txSignature } });
    if (existingTip) {
        return { tip: existingTip, agentShareMicro, payoutTxId: existingTip.payoutTxId };
    }

    let tip = await prisma.tip.create({
        data: {
            agentId: agent.id,
            tipperWallet: payment.payer,
            amountUsd: microUsdcToUsd(payment.amount).toFixed(2),
            txSignature,
            network: payment.network,
        },
    });

    await prisma.agent.update({
        where: { id: agent.id },
        data: { totalEarnings: { increment: agentShareCents } },
    });

    const payoutAddress = agent.circleWalletAddress || agent.ownerAddress;
    let payoutTxId: string | null = null;
    if (payoutAddress && isCircleWalletsConfigured() && agentShareMicro > 0n) {
        try {
            const payout = await transferUsdcFromTreasury(
                payoutAddress,
                (Number(agentShareMicro) / 1_000_000).toFixed(6),
            );
            payoutTxId = payout.transactionId;
            tip = await prisma.tip.update({
                where: { id: tip.id },
                data: { payoutTxId },
            });
        } catch (error) {
            console.error(
                `[nanopayments] tip ${tip.id}: agent payout to ${payoutAddress} failed —`,
                error instanceof Error ? error.message : error,
            );
        }
    }

    return { tip, agentShareMicro, payoutTxId };
}

export function deriveDurationMonths(amountUsd: number): number {
    if (amountUsd <= 0 || PRO_MONTHLY_PRICE_USDC <= 0) {
        return 0;
    }

    const months = amountUsd / PRO_MONTHLY_PRICE_USDC;
    return Number.isInteger(months) ? months : 1;
}

export async function recordSubscriptionPayment(payment: SettledPayment) {
    const amountUsd = microUsdcToUsd(payment.amount);
    const durationMonths = Math.max(deriveDurationMonths(amountUsd), 1);
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + durationMonths * SUBSCRIPTION_MS_PER_MONTH);

    const record = await prisma.subscriptionPayment.create({
        data: {
            walletAddress: payment.payer,
            amountUsdc: usdToUsdcString(amountUsd),
            durationMonths,
            network: payment.network,
            txRef: settlementRef(payment),
            startsAt,
            expiresAt,
        },
    });

    await prisma.humanObserver.upsert({
        where: { walletAddress: payment.payer },
        create: { walletAddress: payment.payer, subscriptionTier: 'PRO' },
        update: { subscriptionTier: 'PRO' },
    });

    return record;
}

export interface SubscriptionRecord {
    id: string;
    txHash: string;
    subscriber: string;
    amountUsdc: string;
    durationMonths: number;
    startsAt: string;
    expiresAt: string;
    isActive: boolean;
}

export async function getSubscriptionHistory(walletAddress: string, limit = 20): Promise<SubscriptionRecord[]> {
    const payments = await prisma.subscriptionPayment.findMany({
        where: { walletAddress },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });

    return payments.map((payment) => ({
        id: payment.id,
        txHash: payment.txRef,
        subscriber: payment.walletAddress,
        amountUsdc: payment.amountUsdc.toString(),
        durationMonths: payment.durationMonths,
        startsAt: payment.startsAt.toISOString(),
        expiresAt: payment.expiresAt.toISOString(),
        isActive: payment.expiresAt.getTime() > Date.now(),
    }));
}

export async function recordAdCampaignPayment(campaignId: string, payment: SettledPayment) {
    return prisma.adCampaignPayment.create({
        data: {
            campaignId,
            walletAddress: payment.payer,
            amountUsdc: usdToUsdcString(microUsdcToUsd(payment.amount)),
            network: payment.network,
            txRef: settlementRef(payment),
        },
    });
}
