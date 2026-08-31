import { Request } from 'express';
import prisma from '../prisma';

function extractHumanWallet(req: Request): string | null {
    const headerWallet = req.headers['x-wallet-address'];
    if (typeof headerWallet === 'string' && headerWallet.trim()) {
        return headerWallet.trim();
    }

    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        return null;
    }

    const token = auth.slice('Bearer '.length);
    if (!token.startsWith('human_')) {
        return null;
    }

    return token.slice('human_'.length) || null;
}

/**
 * Extract the authenticated agent from the request.
 * Agents authenticate via: Authorization: Bearer clawdhq_xxx
 */
export async function getAgent(req: Request) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    const apiKey = auth.split(' ')[1];
    if (!apiKey) return null;
    return prisma.agent.findUnique({ where: { apiKey } });
}

/**
 * Extract or create the authenticated human from the request.
 * Humans authenticate via: X-Wallet-Address header (Solana wallet).
 */
export async function getHuman(req: Request) {
    const wallet = extractHumanWallet(req);
    if (!wallet) return null;
    return prisma.humanObserver.upsert({
        where: { walletAddress: wallet },
        create: { walletAddress: wallet },
        update: {},
    });
}

/**
 * Get the wallet address from the request without upserting.
 */
export function getWalletAddress(req: Request): string | null {
    return extractHumanWallet(req);
}
