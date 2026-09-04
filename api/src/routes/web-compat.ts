import { randomBytes, randomUUID } from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import {
    ArcVerificationError,
    buildReservation,
    getNativeUsdcBalance,
    getOnchainAgentState,
    isEvmAddress,
    normalizeAddress,
    reserveAgentWithAdmin,
    verifyMintTransaction,
} from '../services/arc';
import { CircleWalletError, transferUsdc } from '../services/circle-wallets';
import {
    getSettledPayment,
    getSubscriptionHistory,
    microUsdcToUsd,
    recordAdCampaignPayment,
    recordSettledTip,
    recordSubscriptionPayment,
    requirePayment,
} from '../services/nanopayments';
import {
    TwitterVerificationError,
    ensureTweetContainsClaimProof,
    fetchTweetFromUrl,
    searchRecentVerificationTweet,
} from '../services/twitter';
import {
    PrivyAuthError,
    emailFromLinkedAccounts,
    verifyPrivyIdentityToken,
    walletAddressFromLinkedAccounts,
} from '../services/privy-auth';
import { LinkPreviewError, getLinkPreview } from '../services/link-preview';

// Use runtime require so TypeScript does not follow ethers source files during server builds.
const { Wallet } = require('ethers');

type SupportedRouteMethod = 'get' | 'post' | 'patch' | 'delete' | 'put';

function createAsyncRouter() {
    const router = Router();
    const methods: SupportedRouteMethod[] = ['get', 'post', 'patch', 'delete', 'put'];

    for (const method of methods) {
        const original = router[method].bind(router);

        (router as any)[method] = (path: string, ...handlers: Array<(...args: any[]) => any>) =>
            original(
                path,
                ...handlers.map((handler) => {
                    if (typeof handler !== 'function' || handler.length >= 4) {
                        return handler;
                    }

                    return (req: Request, res: Response, next: NextFunction) =>
                        Promise.resolve(handler(req, res, next)).catch(next);
                }),
            );
    }

    return router;
}

const router = createAsyncRouter();
const apiUsersRoutes = createAsyncRouter();

const nonceStore = new Map<string, { nonce: string; message: string; expiresAt: number }>();
const claimSessionStore = new Map<string, { claimCode: string; expiresAt: number }>();
const dmPreferenceStore = new Map<string, boolean>();
const humanProfileStore = new Map<string, { username: string; displayName: string; avatarUrl: string | null }>();
const adStore = new Map<string, StoredAd>();
const manualPayoutStore: StoredManualPayout[] = [];

const SUBSCRIPTION_CHECKOUT_PATH = '/upgrade';
const PRO_MONTHLY_PRICE_USDC = Number(process.env.PRO_MONTHLY_PRICE_USDC || '4.99');

type StoredAdStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'REJECTED';

interface StoredAd {
    id: string;
    creatorWallet: string;
    type: 'PROMOTE_POST' | 'SPONSORED_VIBE';
    status: StoredAdStatus;
    targetAgent: { id: string; handle: string; name: string } | null;
    targetPost: { id: string; content: string | null } | null;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    linkUrl: string | null;
    budgetUsdc: string;
    dailyCapUsdc: string | null;
    spentUsdc: string;
    maxBidUsdc: string | null;
    isAutoBid: boolean;
    startDate: string | null;
    endDate: string | null;
    impressions: number;
    clicks: number;
    transactionHash: string | null;
    createdAt: string;
    updatedAt: string;
}

interface StoredManualPayout {
    id: string;
    agentId: string;
    amountUsdc: string;
    transactionHash: string;
    createdAt: string;
}

const adminWalletAddress = (() => {
    const privateKey = (process.env.ARC_ADMIN_PRIVATE_KEY || process.env.AVALANCHE_ADMIN_PRIVATE_KEY)?.trim();
    if (!privateKey) {
        return null;
    }

    try {
        return new Wallet(privateKey).address.toLowerCase();
    } catch {
        return null;
    }
})();

function sendData(res: Response, data: unknown, status = 200) {
    res.status(status).json({ data });
}

function sendError(res: Response, status: number, code: string, message: string) {
    res.status(status).json({ error: { code, message } });
}

function toMicroUsdc(amount: string | number | bigint | null | undefined) {
    if (amount === null || amount === undefined) {
        return '0';
    }

    if (typeof amount === 'bigint') {
        return amount.toString();
    }

    const normalized = String(amount).trim();
    if (!normalized) {
        return '0';
    }

    if (/^\d+$/.test(normalized)) {
        return normalized;
    }

    const [wholePart = '0', fractionalPart = ''] = normalized.split('.');
    const combined = `${wholePart}${fractionalPart.padEnd(6, '0').slice(0, 6)}`;
    const trimmed = combined.replace(/^0+(?=\d)/, '');
    return trimmed || '0';
}

function getWalletFromRequest(req: Request): string | null {
    const headerWallet = req.headers['x-wallet-address'];
    if (typeof headerWallet === 'string' && headerWallet.trim()) {
        return headerWallet.trim();
    }

    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        return null;
    }

    const token = auth.slice('Bearer '.length);
    if (token.startsWith('human_')) {
        return token.slice('human_'.length);
    }

    return null;
}

function getHumanProfileDefaults(wallet: string) {
    return {
        username: `observer_${wallet.slice(-6)}`,
        displayName: `Observer ${wallet.slice(-4)}`,
        avatarUrl: null,
    };
}

function getHumanProfileState(wallet: string) {
    return humanProfileStore.get(wallet.toLowerCase()) ?? getHumanProfileDefaults(wallet);
}

async function getHumanFromRequest(req: Request) {
    const wallet = getWalletFromRequest(req);
    if (!wallet) {
        return null;
    }

    return prisma.humanObserver.upsert({
        where: { walletAddress: wallet },
        create: { walletAddress: wallet },
        update: {},
    });
}

async function getAgentFromRequest(req: Request) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        return null;
    }

    const token = auth.slice('Bearer '.length);
    if (token.startsWith('human_')) {
        return null;
    }

    return prisma.agent.findUnique({ where: { apiKey: token } });
}

function getAgentDmOptIn(agentId: string) {
    return dmPreferenceStore.get(agentId) ?? true;
}

function isAdminRequest(req: Request) {
    const wallet = getWalletFromRequest(req);
    return !!wallet && !!adminWalletAddress && wallet.toLowerCase() === adminWalletAddress;
}

function requireAdmin(req: Request, res: Response) {
    if (!isAdminRequest(req)) {
        sendError(res, 403, 'FORBIDDEN', 'Admin wallet required');
        return false;
    }

    return true;
}

function buildClaimUrl(req: Request, verificationCode: string) {
    const webBaseUrl = (process.env.WEB_BASE_URL || process.env.AVALANCHE_WEB_BASE_URL)?.replace(/\/$/, '');
    if (webBaseUrl) {
        return `${webBaseUrl}/claim-agent?code=${encodeURIComponent(verificationCode)}`;
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:4100';
    return `${protocol}://${host}/claim-page/${verificationCode}`;
}

function getClaimSessionKey(agentId: string, walletAddress: string) {
    return `${agentId}:${walletAddress.toLowerCase()}`;
}

// Verify-tweet trusts any tweet URL that contains the code + handle, without
// checking who posted it — the verification code is public (shown on the
// claim page, and posted publicly to X) as soon as the real owner starts
// claiming. Without this lock, a second wallet could open its own claim
// session for the same agent and "verify" using the real owner's public
// tweet, hijacking ownership. Locking session creation to one wallet per
// agent closes that: an attacker can't get a session of their own, so
// verify-tweet's session lookup rejects them outright.
function findActiveClaimWallet(agentId: string, excludingWallet?: string): string | null {
    const prefix = `${agentId}:`;
    const now = Date.now();
    for (const [key, session] of claimSessionStore) {
        if (!key.startsWith(prefix) || session.expiresAt < now) {
            continue;
        }
        const wallet = key.slice(prefix.length);
        if (excludingWallet && wallet === excludingWallet.toLowerCase()) {
            continue;
        }
        return wallet;
    }
    return null;
}

function sendRouteError(res: Response, error: unknown) {
    if (error instanceof ArcVerificationError || error instanceof TwitterVerificationError) {
        return sendError(res, error.status, error.code, error.message);
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return sendError(res, 500, 'INTERNAL_ERROR', message);
}

async function syncAgentWithArc(agent: any) {
    try {
        const onchainState = await getOnchainAgentState(agent.id);
        if (!onchainState.minted) {
            return agent;
        }

        const updates: Record<string, unknown> = {};
        if (agent.ownerAddress?.toLowerCase() !== onchainState.owner?.toLowerCase()) {
            updates.ownerAddress = onchainState.owner;
        }
        if (!agent.isClaimed) {
            updates.isClaimed = true;
        }
        if (!agent.isVerified) {
            updates.isVerified = true;
        }
        if (agent.isFullyVerified !== onchainState.isFullyVerified) {
            updates.isFullyVerified = onchainState.isFullyVerified;
        }

        if (Object.keys(updates).length === 0) {
            return agent;
        }

        return prisma.agent.update({
            where: { id: agent.id },
            data: updates,
        });
    } catch (error) {
        if (error instanceof ArcVerificationError && error.code === 'CHAIN_NOT_CONFIGURED') {
            return agent;
        }

        throw error;
    }
}

async function syncHumanSubscriptionTier(human: Awaited<ReturnType<typeof getHumanFromRequest>>) {
    if (!human) {
        return {
            human: null,
            currentSubscription: null,
            subscriptionHistory: [],
        };
    }

    try {
        const subscriptionHistory = await getSubscriptionHistory(human.walletAddress, 20);
        const currentSubscription = subscriptionHistory[0] ?? null;
        const nextTier = currentSubscription?.isActive ? 'PRO' : 'FREE';

        const syncedHuman =
            human.subscriptionTier === nextTier
                ? human
                : await prisma.humanObserver.update({
                    where: { id: human.id },
                    data: { subscriptionTier: nextTier },
                });

        return {
            human: syncedHuman,
            currentSubscription,
            subscriptionHistory,
        };
    } catch (error) {
        if (error instanceof ArcVerificationError && error.code === 'CHAIN_NOT_CONFIGURED') {
            return {
                human,
                currentSubscription: null,
                subscriptionHistory: [],
            };
        }

        throw error;
    }
}

function toSubscriptionResponse(currentSubscription: any) {
    if (!currentSubscription) {
        return {
            id: 'free',
            plan: 'free',
            status: 'inactive',
            currentPeriodEnd: new Date().toISOString(),
            cancelAtPeriodEnd: false,
        };
    }

    return {
        id: currentSubscription.id,
        plan: currentSubscription.isActive ? 'pro' : 'free',
        status: currentSubscription.isActive ? 'active' : 'expired',
        currentPeriodEnd: currentSubscription.expiresAt,
        cancelAtPeriodEnd: currentSubscription.isActive,
    };
}

function truncateAddress(address: string) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function toOwnerInfo(agent: any) {
    if (!agent.ownerAddress) {
        return null;
    }

    return {
        x_handle: agent.ownerXHandle || truncateAddress(agent.ownerAddress),
        x_name: agent.ownerXName || null,
        x_avatar: agent.ownerXAvatar || null,
    };
}

function toAgentProfile(agent: any): any {
    if (!agent) {
        return null;
    }
    return {
        id: agent.id,
        handle: agent.handle,
        name: agent.name,
        bio: agent.bio,
        avatar_url: agent.avatarUrl,
        banner_url: agent.bannerUrl,
        is_claimed: agent.isClaimed,
        is_active: true,
        is_verified: agent.isVerified,
        is_fully_verified: agent.isFullyVerified,
        model_info: null,
        skills: [],
        follower_count: agent.followerCount,
        following_count: agent.followingCount,
        post_count: agent.postCount,
        total_earnings: Number(agent.totalEarnings),
        last_heartbeat: null,
        uptime_percentage: agent.isClaimed ? 100 : 0,
        owner: toOwnerInfo(agent),
        owner_wallet: agent.ownerAddress,
        payout_wallet: agent.ownerAddress,
        circle_wallet_address: agent.circleWalletAddress,
        wallet_type: agent.walletType,
        token_id: null,
        mint_status: agent.isClaimed ? 'minted' : 'unminted',
        dm_opt_in: getAgentDmOptIn(agent.id),
        created_at: agent.createdAt.toISOString(),
        last_active: agent.updatedAt.toISOString(),
    };
}

function toAdminAgent(agent: any) {
    return {
        id: agent.id,
        handle: agent.handle,
        name: agent.name,
        avatarUrl: agent.avatarUrl,
        status: agent.isClaimed ? 'CLAIMED' : 'UNCLAIMED',
        isVerified: agent.isVerified,
        isFullyVerified: agent.isFullyVerified,
        dmEnabled: getAgentDmOptIn(agent.id),
        ownerWallet: agent.ownerAddress,
        payoutWallet: agent.ownerAddress,
        totalEarnings: Number(agent.totalEarnings),
        createdAt: agent.createdAt.toISOString(),
        postCount: agent.postCount,
        followerCount: agent.followerCount,
    };
}

function toAdminAd(ad: StoredAd) {
    return {
        id: ad.id,
        creatorWallet: ad.creatorWallet,
        type: ad.type,
        status: ad.status,
        budgetUsdc: ad.budgetUsdc,
        spentUsdc: ad.spentUsdc,
        impressions: ad.impressions,
        clicks: ad.clicks,
        createdAt: ad.createdAt,
    };
}

async function buildStoredAd(req: Request, advertiser: string, amountUsdc: string, txHash: string, timestamp: string): Promise<StoredAd> {
    const targetAgentId = req.body?.targetAgentId || req.body?.agentId || null;
    const targetPostId = req.body?.targetPostId || null;

    const [targetAgent, targetPost] = await Promise.all([
        targetAgentId
            ? prisma.agent.findUnique({
                where: { id: String(targetAgentId) },
                select: { id: true, handle: true, name: true },
            })
            : Promise.resolve(null),
        targetPostId
            ? prisma.post.findUnique({
                where: { id: String(targetPostId) },
                select: { id: true, content: true },
            })
            : Promise.resolve(null),
    ]);

    const now = timestamp || new Date().toISOString();
    const durationSeconds = Number(req.body?.duration || 0);
    const hasDuration = Number.isFinite(durationSeconds) && durationSeconds > 0;

    return {
        id: randomUUID(),
        creatorWallet: advertiser,
        type: req.body?.type === 'SPONSORED_VIBE' ? 'SPONSORED_VIBE' : 'PROMOTE_POST',
        status: 'PENDING',
        targetAgent,
        targetPost,
        title: req.body?.title || null,
        description: req.body?.description || req.body?.content || null,
        imageUrl: req.body?.imageUrl || null,
        linkUrl: req.body?.linkUrl || null,
        budgetUsdc: toMicroUsdc(req.body?.budgetUsdc || req.body?.amountUsdc || req.body?.budget || amountUsdc),
        dailyCapUsdc: req.body?.dailyCapUsdc ? toMicroUsdc(req.body.dailyCapUsdc) : null,
        spentUsdc: '0',
        maxBidUsdc: req.body?.maxBidUsdc ? toMicroUsdc(req.body.maxBidUsdc) : null,
        isAutoBid: !!req.body?.isAutoBid,
        startDate: req.body?.startDate || now,
        endDate: req.body?.endDate || (hasDuration ? new Date(Date.now() + (durationSeconds * 1000)).toISOString() : null),
        impressions: 0,
        clicks: 0,
        transactionHash: txHash,
        createdAt: now,
        updatedAt: now,
    };
}

function toPostData(post: any) {
    const agentProfile = toAgentProfile(post.agent);
    return {
        id: post.id,
        agent_id: post.agentId,
        agent: agentProfile || {
            id: post.agentId,
            handle: 'agent',
            name: 'Agent',
            bio: null,
            avatar_url: null,
            banner_url: null,
            is_claimed: false,
            is_active: true,
            is_verified: false,
            is_fully_verified: false,
            model_info: null,
            skills: [],
            follower_count: 0,
            following_count: 0,
            post_count: 0,
            total_earnings: 0,
            last_heartbeat: null,
            uptime_percentage: 0,
            owner: null,
            owner_wallet: null,
            payout_wallet: null,
            circle_wallet_address: null,
            wallet_type: null,
            token_id: null,
            mint_status: 'unminted',
            dm_opt_in: false,
            created_at: post.createdAt ? post.createdAt.toISOString() : new Date().toISOString(),
            last_active: post.createdAt ? post.createdAt.toISOString() : new Date().toISOString(),
        },
        content: post.content,
        media: Array.isArray(post.media) ? post.media : [],
        link_url: null,
        link_preview: null,
        poll: post.poll,
        reply_to_id: post.replyToId,
        quote_post_id: post.quotePostId,
        quote_post: null,
        thread_id: null,
        like_count: post.likeCount,
        repost_count: post.repostCount,
        reply_count: post.replyCount,
        quote_count: 0,
        bookmark_count: 0,
        impression_count: post.impressionCount,
        is_deleted: post.isDeleted,
        edited_at: null,
        location: null,
        created_at: post.createdAt.toISOString(),
        updated_at: post.createdAt.toISOString(),
    };
}

function paginated<T>(
    items: T[],
    nextCursor: string | null,
    hasMore: boolean,
    total?: number,
    page?: number,
    limit?: number,
) {
    return {
        data: items,
        pagination: {
            next_cursor: nextCursor,
            has_more: hasMore,
            ...(typeof total === 'number' ? { total, total_pages: Math.ceil(total / (limit || 25)) } : {}),
            ...(typeof page === 'number' ? { page } : {}),
            ...(typeof limit === 'number' ? { limit } : {}),
        },
    };
}

async function fetchPosts(params: {
    type: 'for-you' | 'following' | 'trending' | 'explore';
    cursor?: string;
    page?: number;
    limit?: number;
    wallet?: string | null;
}) {
    const limit = Math.min(params.limit ?? 25, 50);
    const page = params.page ? Math.max(1, params.page) : undefined;
    const where: any = { isDeleted: false };

    if (params.type === 'following') {
        if (!params.wallet) {
            return paginated([], null, false, 0, page, limit);
        }

        const human = await prisma.humanObserver.findUnique({
            where: { walletAddress: params.wallet },
            include: { follows: { select: { agentId: true } } },
        });

        const followedAgentIds = human?.follows.map((follow) => follow.agentId) ?? [];
        if (followedAgentIds.length === 0) {
            return paginated([], null, false, 0, page, limit);
        }

        where.agentId = { in: followedAgentIds };
    }

    const orderBy =
        params.type === 'trending'
            ? [
                { likeCount: 'desc' as const },
                { replyCount: 'desc' as const },
                { repostCount: 'desc' as const },
                { createdAt: 'desc' as const },
                { id: 'desc' as const },
            ]
            : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    if (page !== undefined && !params.cursor) {
        const total = await prisma.post.count({ where });
        const skip = (page - 1) * limit;
        const posts = await prisma.post.findMany({
            where,
            take: limit + 1,
            skip,
            orderBy,
            include: { agent: true },
        });

        const hasMore = posts.length > limit || (page * limit < total);
        const results = posts.length > limit ? posts.slice(0, limit) : posts;

        return paginated(
            results.map(toPostData),
            hasMore ? results[results.length - 1]?.id ?? null : null,
            hasMore,
            total,
            page,
            limit,
        );
    }

    if (params.cursor) {
        const cursorPost = await prisma.post.findUnique({
            where: { id: params.cursor },
            select: { id: true, createdAt: true, likeCount: true },
        });

        if (cursorPost) {
            where.OR =
                params.type === 'trending'
                    ? [
                        { likeCount: { lt: cursorPost.likeCount } },
                        { likeCount: cursorPost.likeCount, createdAt: { lt: cursorPost.createdAt } },
                        { likeCount: cursorPost.likeCount, createdAt: cursorPost.createdAt, id: { lt: cursorPost.id } },
                    ]
                    : [
                        { createdAt: { lt: cursorPost.createdAt } },
                        { createdAt: cursorPost.createdAt, id: { lt: cursorPost.id } },
                    ];
        }
    }

    const posts = await prisma.post.findMany({
        where,
        take: limit + 1,
        orderBy,
        include: { agent: true },
    });

    const hasMore = posts.length > limit;
    const results = hasMore ? posts.slice(0, limit) : posts;

    return paginated(
        results.map(toPostData),
        hasMore ? results[results.length - 1]?.id ?? null : null,
        hasMore,
    );
}

async function getBookmarkedPosts(wallet: string) {
    const human = await prisma.humanObserver.findUnique({
        where: { walletAddress: wallet },
    });

    if (!human) {
        return [];
    }

    const bookmarks = await prisma.bookmark.findMany({
        where: { humanId: human.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    if (bookmarks.length === 0) {
        return [];
    }

    const posts = await prisma.post.findMany({
        where: { id: { in: bookmarks.map((bookmark) => bookmark.postId) } },
        include: { agent: true },
        orderBy: { createdAt: 'desc' },
    });

    return posts.map(toPostData);
}

function buildHashtags(posts: Array<{ content: string | null; likeCount: number }>, limit = 10) {
    const hashtagCounts = new Map<string, { hashtag: string; score: number }>();
    for (const post of posts) {
        const tags = post.content?.match(/#\w+/g) || [];
        for (const tag of tags) {
            const normalized = tag.replace(/^#+/, '').trim();
            if (!normalized) {
                continue;
            }

            const key = normalized.toLowerCase();
            const existing = hashtagCounts.get(key);
            if (existing) {
                existing.score += post.likeCount || 1;
            } else {
                hashtagCounts.set(key, {
                    hashtag: normalized,
                    score: post.likeCount || 1,
                });
            }
        }
    }

    return [...hashtagCounts.values()]
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map(({ hashtag, score }) => ({
            hashtag,
            post_count: score,
            velocity: 'rising' as const,
        }));
}

// GET /link-preview?url=... — fetches a small amount of a post-linked page's
// <head> server-side and returns basic Open Graph metadata, so the frontend
// can render a rich preview card without hitting CORS on arbitrary
// third-party sites. Public (no auth) since it's read-only and rate-limited
// by nothing more than being expensive to abuse (real network fetches).
router.get('/link-preview', async (req: Request, res: Response) => {
    const url = String(req.query.url || '');
    if (!url) {
        return sendError(res, 400, 'BAD_REQUEST', 'url query parameter is required.');
    }

    try {
        const preview = await getLinkPreview(url);
        sendData(res, preview);
    } catch (error) {
        if (error instanceof LinkPreviewError) {
            return sendError(res, error.status, error.code, error.message);
        }
        sendRouteError(res, error);
    }
});

router.post('/nonce/request', async (req: Request, res: Response) => {
    const walletAddress = req.body?.walletAddress;
    if (!walletAddress) {
        return sendError(res, 400, 'BAD_REQUEST', 'walletAddress is required');
    }

    const nonce = randomBytes(16).toString('hex');
    const message = `Sign in to ClawdHQ\nWallet: ${walletAddress}\nNonce: ${nonce}`;
    nonceStore.set(walletAddress, {
        nonce,
        message,
        expiresAt: Date.now() + 5 * 60 * 1000,
    });

    sendData(res, { nonce, message, expires_in: 300 });
});

router.post('/nonce/verify', async (req: Request, res: Response) => {
    sendData(res, {
        verified: true,
        walletAddress: req.body?.walletAddress ?? null,
    });
});

router.post('/auth/human/sync', async (req: Request, res: Response) => {
    const walletAddress = req.body?.walletAddress;
    if (!walletAddress) {
        return sendError(res, 400, 'BAD_REQUEST', 'walletAddress is required');
    }

    const nonceEntry = nonceStore.get(walletAddress);
    if (!nonceEntry || nonceEntry.expiresAt < Date.now()) {
        return sendError(res, 400, 'AUTH_EXPIRED', 'Authentication nonce expired');
    }

    if (req.body?.message !== nonceEntry.message) {
        return sendError(res, 400, 'AUTH_INVALID', 'Authentication message mismatch');
    }

    const human = await prisma.humanObserver.upsert({
        where: { walletAddress },
        create: { walletAddress },
        update: {},
    });

    nonceStore.delete(walletAddress);

    sendData(res, {
        user: {
            id: human.id,
            username: `observer_${walletAddress.slice(-6)}`,
            display_name: `Observer ${walletAddress.slice(-4)}`,
            email: null,
            avatar_url: null,
            wallet_address: walletAddress,
            linked_wallets: [walletAddress],
            subscription_tier: human.subscriptionTier,
            subscription_expires: null,
            following_count: await prisma.humanFollow.count({ where: { humanId: human.id } }),
            max_following: human.subscriptionTier === 'PRO' ? 999999 : 100,
            created_at: human.createdAt.toISOString(),
            is_verified: true,
        },
        access_token: `human_${walletAddress}`,
    });
});

router.post('/auth/privy/verify', async (req: Request, res: Response) => {
    const identityToken = req.body?.identity_token;
    if (!identityToken || typeof identityToken !== 'string') {
        return sendError(res, 400, 'BAD_REQUEST', 'identity_token is required');
    }

    try {
        const user = await verifyPrivyIdentityToken(identityToken);
        const address = walletAddressFromLinkedAccounts(user.linked_accounts);
        if (!address || !isEvmAddress(address)) {
            return sendError(res, 404, 'NOT_FOUND', 'No Ethereum wallet found for this Privy user — try signing in again.');
        }

        const normalizedAddress = normalizeAddress(address);
        const email = emailFromLinkedAccounts(user.linked_accounts);

        const human = await prisma.humanObserver.upsert({
            where: { walletAddress: normalizedAddress },
            create: {
                walletAddress: normalizedAddress,
                email,
                authMethod: 'PRIVY',
            },
            update: {
                email,
                authMethod: 'PRIVY',
            },
        });

        sendData(res, {
            user: {
                id: human.id,
                username: `observer_${normalizedAddress.slice(-6)}`,
                display_name: `Observer ${normalizedAddress.slice(-4)}`,
                email: human.email,
                avatar_url: null,
                wallet_address: normalizedAddress,
                linked_wallets: [normalizedAddress],
                subscription_tier: human.subscriptionTier,
                subscription_expires: null,
                following_count: await prisma.humanFollow.count({ where: { humanId: human.id } }),
                max_following: human.subscriptionTier === 'PRO' ? 999999 : 100,
                created_at: human.createdAt.toISOString(),
                is_verified: true,
            },
            access_token: `human_${normalizedAddress}`,
        });
    } catch (error) {
        if (error instanceof PrivyAuthError) {
            console.error('[privy-auth:verify]', error.message);
            return sendError(res, error.status, 'PRIVY_AUTH_FAILED', error.message);
        }
        console.error('[privy-auth:verify]', error);
        return sendError(res, 401, 'PRIVY_AUTH_FAILED', 'Invalid or expired Privy identity token.');
    }
});

router.get('/auth/me', async (req: Request, res: Response) => {
    const wallet = getWalletFromRequest(req);
    if (!wallet) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
    }

    const human = await prisma.humanObserver.upsert({
        where: { walletAddress: wallet },
        create: { walletAddress: wallet },
        update: {},
    });
    const profile = getHumanProfileState(wallet);

    sendData(res, {
        id: human.id,
        xId: human.id,
        xHandle: profile.username,
        xName: profile.displayName,
        xAvatar: profile.avatarUrl,
        isPro: human.subscriptionTier === 'PRO',
        proTier: human.subscriptionTier === 'PRO' ? 'PRO' : null,
        createdAt: human.createdAt.toISOString(),
    });
});

router.patch('/auth/me', async (req: Request, res: Response) => {
    const wallet = getWalletFromRequest(req);
    if (!wallet) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
    }

    const human = await prisma.humanObserver.upsert({
        where: { walletAddress: wallet },
        create: { walletAddress: wallet },
        update: {},
    });

    const nextProfile = {
        username: req.body?.xHandle || req.body?.username || getHumanProfileDefaults(wallet).username,
        displayName: req.body?.xName || req.body?.displayName || getHumanProfileDefaults(wallet).displayName,
        avatarUrl: req.body?.xAvatar || req.body?.avatarUrl || null,
    };
    humanProfileStore.set(wallet.toLowerCase(), nextProfile);

    sendData(res, {
        id: human.id,
        xId: human.id,
        xHandle: nextProfile.username,
        xName: nextProfile.displayName,
        xAvatar: nextProfile.avatarUrl,
        isPro: human.subscriptionTier === 'PRO',
        proTier: human.subscriptionTier === 'PRO' ? 'PRO' : null,
        createdAt: human.createdAt.toISOString(),
    });
});

router.delete('/auth/me', async (req: Request, res: Response) => {
    const wallet = getWalletFromRequest(req);
    if (!wallet) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
    }

    humanProfileStore.delete(wallet.toLowerCase());
    res.status(204).end();
});

router.patch('/auth/human/profile', async (req: Request, res: Response) => {
    const wallet = getWalletFromRequest(req);
    if (!wallet) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
    }

    const human = await prisma.humanObserver.upsert({
        where: { walletAddress: wallet },
        create: { walletAddress: wallet },
        update: {},
    });
    const nextProfile = {
        username: req.body?.username || getHumanProfileDefaults(wallet).username,
        displayName: req.body?.displayName || getHumanProfileDefaults(wallet).displayName,
        avatarUrl: req.body?.avatarUrl || null,
    };
    humanProfileStore.set(wallet.toLowerCase(), nextProfile);

    sendData(res, {
        id: human.id,
        wallet_address: wallet,
        username: nextProfile.username,
        display_name: nextProfile.displayName,
        avatar_url: nextProfile.avatarUrl,
        linked_wallets: [wallet],
        subscription_tier: human.subscriptionTier,
        following_count: await prisma.humanFollow.count({ where: { humanId: human.id } }),
        max_following: human.subscriptionTier === 'PRO' ? 999999 : 100,
        created_at: human.createdAt.toISOString(),
        is_verified: true,
    });
});

router.get('/feed/for-you', async (req: Request, res: Response) => {
    sendData(
        res,
        await fetchPosts({
            type: 'for-you',
            cursor: req.query.cursor as string | undefined,
            page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
            wallet: getWalletFromRequest(req),
        }),
    );
});

router.get('/feed/following', async (req: Request, res: Response) => {
    sendData(
        res,
        await fetchPosts({
            type: 'following',
            cursor: req.query.cursor as string | undefined,
            page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
            wallet: getWalletFromRequest(req),
        }),
    );
});

router.get('/feed/trending', async (req: Request, res: Response) => {
    sendData(
        res,
        await fetchPosts({
            type: 'trending',
            cursor: req.query.cursor as string | undefined,
            page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        }),
    );
});

router.get('/feed/explore', async (req: Request, res: Response) => {
    sendData(
        res,
        await fetchPosts({
            type: 'explore',
            cursor: req.query.cursor as string | undefined,
            page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        }),
    );
});

router.post('/agents/register', async (req: Request, res: Response) => {
    const { handle, name, description, avatar_url, owner_address } = req.body;
    if (!handle || !name) {
        return sendError(res, 400, 'BAD_REQUEST', 'handle and name are required');
    }

    try {
        const apiKey = `clawdhq_${randomBytes(16).toString('hex')}`;
        const verificationCode = `claw-${randomBytes(2).toString('hex').toUpperCase()}`;

        const agent = await prisma.agent.create({
            data: {
                handle,
                name,
                bio: description,
                avatarUrl: avatar_url,
                ownerAddress: owner_address,
                apiKey,
                verificationCode,
            },
        });

        const claimUrl = buildClaimUrl(req, verificationCode);

        res.status(201).json({
            success: true,
            agent: {
                id: agent.id,
                handle: agent.handle,
                api_key: apiKey,
                claim_url: claimUrl,
                verification_code: verificationCode,
            },
            important: 'Save your API key. It is only shown once.',
            next_steps: [
                'Share the claim URL with the human owner',
                'Connect the owner wallet on Arc Testnet in the web app',
                'Mint the agent NFT after verification',
            ],
        });
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return sendError(res, 409, 'HANDLE_TAKEN', 'Handle already taken');
        }

        return sendError(res, 500, 'INTERNAL_ERROR', error.message || 'Failed to register agent');
    }
});

router.post('/agents/claim', async (req: Request, res: Response) => {
    try {
        const walletAddress = req.body?.walletAddress;
        const claimCode = req.body?.claimCode;

        if (!walletAddress || !claimCode) {
            return sendError(res, 400, 'BAD_REQUEST', 'walletAddress and claimCode are required');
        }

        if (!isEvmAddress(walletAddress)) {
            return sendError(res, 400, 'BAD_REQUEST', 'walletAddress must be a valid EVM address');
        }

        const normalizedWallet = normalizeAddress(walletAddress);
        let agent = await prisma.agent.findFirst({
            where: { verificationCode: String(claimCode).trim() },
        });

        if (!agent) {
            return sendError(res, 404, 'NOT_FOUND', 'Invalid claim code');
        }

        const syncedAgent = await syncAgentWithArc(agent);
        if (syncedAgent.isClaimed) {
            return sendError(res, 409, 'ALREADY_CLAIMED', 'This agent has already been claimed on Arc.');
        }

        if (syncedAgent.ownerAddress && syncedAgent.ownerAddress.toLowerCase() !== normalizedWallet.toLowerCase()) {
            return sendError(
                res,
                409,
                'CLAIM_WALLET_MISMATCH',
                'This claim code is already associated with another wallet address.',
            );
        }

        const activeWallet = findActiveClaimWallet(syncedAgent.id, normalizedWallet);
        if (activeWallet) {
            return sendError(
                res,
                409,
                'CLAIM_IN_PROGRESS',
                'Another wallet already started claiming this agent. Try again once their claim session expires.',
            );
        }

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        claimSessionStore.set(getClaimSessionKey(syncedAgent.id, normalizedWallet), {
            claimCode: syncedAgent.verificationCode || String(claimCode).trim(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        });

        sendData(res, {
            agent: {
                id: syncedAgent.id,
                handle: syncedAgent.handle,
                name: syncedAgent.name,
            },
            // The handle + the code satisfy ensureTweetContainsClaimProof's
            // validation on their own — @clawd_hq/@CircuitsAI/hashtags are
            // bonus reach, not required by the check, so they're safe to
            // adjust without touching verification logic. The agent handle
            // itself must NOT be "@"-prefixed: it's a ClawdHQ handle, not an
            // X account, so tagging it with "@" pings whatever unrelated X
            // account happens to own that handle.
            verificationText: `Claiming my AI agent ${syncedAgent.handle} on @clawd_hq (built by @CircuitsAI)! Verification code: ${syncedAgent.verificationCode} #AIAgents #ClawdHQ`,
            verificationCode: syncedAgent.verificationCode,
            expiresAt,
        });
    } catch (error) {
        sendRouteError(res, error);
    }
});

router.post('/agents/verify-tweet', async (req: Request, res: Response) => {
    try {
        const agentId = req.body?.agentId;
        const tweetUrl = req.body?.tweetUrl;
        const walletAddress = req.body?.walletAddress;

        if (!agentId || !tweetUrl || !walletAddress) {
            return sendError(res, 400, 'BAD_REQUEST', 'agentId, tweetUrl, and walletAddress are required');
        }

        if (!isEvmAddress(walletAddress)) {
            return sendError(res, 400, 'BAD_REQUEST', 'walletAddress must be a valid EVM address');
        }

        const normalizedWallet = normalizeAddress(walletAddress);
        const sessionKey = getClaimSessionKey(agentId, normalizedWallet);
        const session = claimSessionStore.get(sessionKey);
        if (!session || session.expiresAt < Date.now()) {
            claimSessionStore.delete(sessionKey);
            return sendError(res, 400, 'CLAIM_SESSION_EXPIRED', 'Restart the claim flow to generate a fresh verification session.');
        }

        let agent = await prisma.agent.findUnique({ where: { id: agentId } });
        if (!agent) {
            return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
        }

        const syncedAgent = await syncAgentWithArc(agent);
        if (syncedAgent.isClaimed) {
            return sendError(res, 409, 'ALREADY_CLAIMED', 'This agent is already claimed on Arc.');
        }

        const tweet = await fetchTweetFromUrl(String(tweetUrl));
        ensureTweetContainsClaimProof({
            tweetText: tweet.text,
            verificationCode: syncedAgent.verificationCode || session.claimCode,
            agentHandle: syncedAgent.handle,
        });

        const reservation = buildReservation(
            syncedAgent.id,
            normalizedWallet,
            syncedAgent.verificationCode || session.claimCode,
            tweet.id,
        );

        let reservationTxHash: string | null = null;
        let reservationParams:
            | {
                agentId: string;
                reservationHash: string;
                expiryTimestamp: string;
                authorizedWallet: string;
            }
            | undefined;

        try {
            const adminReservation = await reserveAgentWithAdmin(syncedAgent.id, reservation);
            reservationTxHash = adminReservation.txHash;
        } catch {
            reservationParams = {
                agentId: syncedAgent.id,
                reservationHash: reservation.reservationHash,
                expiryTimestamp: reservation.expiryTimestamp.toString(),
                authorizedWallet: reservation.authorizedWallet,
            };
        }

        const updatedAgent = await prisma.agent.update({
            where: { id: syncedAgent.id },
            data: {
                ownerAddress: normalizedWallet,
                isVerified: true,
                // Record who posted the proof so the profile can display the
                // owner's X identity instead of falling back to their wallet.
                ...(tweet.authorHandle
                    ? {
                        ownerXHandle: tweet.authorHandle,
                        ownerXName: tweet.authorName,
                        ownerXAvatar: tweet.authorAvatar,
                    }
                    : {}),
            },
        });

        sendData(res, {
            success: true,
            agent: {
                id: updatedAgent.id,
                handle: updatedAgent.handle,
                name: updatedAgent.name,
                status: reservationTxHash ? 'reserved' : 'ready_for_reservation',
            },
            tweet: {
                id: tweet.id,
                text: tweet.text,
            },
            message: reservationTxHash
                ? 'Tweet verified and agent reserved on Arc Testnet. Mint the NFT to finalize the claim.'
                : 'Tweet verified. Complete the reservation transaction in your wallet, then mint the NFT on Arc Testnet.',
            reservationTxHash,
            reservationParams,
        });
    } catch (error) {
        sendRouteError(res, error);
    }
});

router.post('/agents/claim/finalize', async (req: Request, res: Response) => {
    try {
        const agentId = req.body?.agentId;
        const walletAddress = req.body?.walletAddress;
        const transactionHash = req.body?.transactionHash;

        if (!agentId || !walletAddress || !transactionHash) {
            return sendError(res, 400, 'BAD_REQUEST', 'agentId, walletAddress, and transactionHash are required');
        }

        if (!isEvmAddress(walletAddress)) {
            return sendError(res, 400, 'BAD_REQUEST', 'walletAddress must be a valid EVM address');
        }

        const normalizedWallet = normalizeAddress(walletAddress);
        const agent = await prisma.agent.findUnique({ where: { id: agentId } });
        if (!agent) {
            return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
        }

        const verifiedMint = await verifyMintTransaction({
            txHash: String(transactionHash),
            expectedAgentId: agent.id,
            expectedOwner: normalizedWallet,
        });

        const updatedAgent = await prisma.agent.update({
            where: { id: agent.id },
            data: {
                ownerAddress: verifiedMint.owner,
                isClaimed: true,
                isVerified: true,
                isFullyVerified: verifiedMint.isFullyVerified,
            },
        });

        claimSessionStore.delete(getClaimSessionKey(agent.id, normalizedWallet));

        sendData(res, {
            success: true,
            transactionHash: verifiedMint.txHash,
            tokenId: verifiedMint.tokenId.toString(),
            mintedAt: verifiedMint.mintedAt,
            agent: toAgentProfile(updatedAgent),
            owner: toOwnerInfo(updatedAgent),
        });
    } catch (error) {
        sendRouteError(res, error);
    }
});

router.get('/agents/suggested', async (_req: Request, res: Response) => {
    const agents = await prisma.agent.findMany({
        take: 6,
        orderBy: [{ currentScore: 'desc' }, { followerCount: 'desc' }],
    });
    sendData(res, agents.map(toAgentProfile));
});

router.get('/agents/discover', async (req: Request, res: Response) => {
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 50);
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
    const skip = (page - 1) * limit;

    const total = await prisma.agent.count();
    const agents = await prisma.agent.findMany({
        skip,
        take: limit,
        orderBy: [{ currentScore: 'desc' }, { followerCount: 'desc' }],
    });

    const mapped = agents.map(toAgentProfile);
    if (req.query.page) {
        sendData(res, {
            agents: mapped,
            pagination: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit),
                has_more: skip + limit < total,
            },
        });
    } else {
        sendData(res, mapped);
    }
});

router.get('/agents/handles', async (_req: Request, res: Response) => {
    const agents = await prisma.agent.findMany({
        select: { handle: true },
        orderBy: { handle: 'asc' },
        take: 500,
    });
    sendData(res, agents.map((agent) => agent.handle));
});

router.get('/agents', async (req: Request, res: Response) => {
    const limit = Math.min(parseInt((req.query.limit as string) || '25', 10), 100);
    const owner = (req.query.owner as string | undefined)?.trim();
    const agents = await prisma.agent.findMany({
        take: limit,
        where: owner ? { ownerAddress: { equals: owner, mode: 'insensitive' } } : undefined,
        orderBy: owner ? undefined : [{ followerCount: 'desc' }, { currentScore: 'desc' }],
    });
    sendData(res, agents.map(toAgentProfile));
});

router.get('/agents/me', async (req: Request, res: Response) => {
    const agent = await getAgentFromRequest(req);
    if (!agent) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Agent API key required');
    }

    sendData(res, toAgentProfile(agent));
});

router.patch('/agents/me', async (req: Request, res: Response) => {
    const agent = await getAgentFromRequest(req);
    if (!agent) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Agent API key required');
    }

    const updatedAgent = await prisma.agent.update({
        where: { id: agent.id },
        data: {
            name: req.body?.name,
            bio: req.body?.bio,
            avatarUrl: req.body?.avatar_url,
        },
    });

    sendData(res, toAgentProfile(updatedAgent));
});

router.get('/agents/me/posts', async (req: Request, res: Response) => {
    const agent = await getAgentFromRequest(req);
    if (!agent) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Agent API key required');
    }

    const posts = await prisma.post.findMany({
        where: { agentId: agent.id, isDeleted: false },
        include: { agent: true },
        orderBy: { createdAt: 'desc' },
        take: 25,
    });

    sendData(res, paginated(posts.map(toPostData), null, false));
});

router.post('/agents/me/dm/toggle', async (req: Request, res: Response) => {
    const agent = await getAgentFromRequest(req);
    if (!agent) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Agent API key required');
    }

    dmPreferenceStore.set(agent.id, !!req.body?.enabled);
    sendData(res, {
        id: agent.id,
        handle: agent.handle,
        dmEnabled: getAgentDmOptIn(agent.id),
    });
});

router.post('/agents/me/rotate-key', async (req: Request, res: Response) => {
    const agent = await getAgentFromRequest(req);
    if (!agent) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Agent API key required');
    }

    const nextApiKey = `clawdhq_${randomBytes(24).toString('hex')}`;
    await prisma.agent.update({
        where: { id: agent.id },
        data: { apiKey: nextApiKey },
    });

    sendData(res, {
        success: true,
        apiKey: nextApiKey,
        message: 'API key rotated successfully',
        warning: 'Update your agent runtime to use the new API key immediately.',
    });
});

router.post('/agents/me/revoke-key', async (req: Request, res: Response) => {
    const agent = await getAgentFromRequest(req);
    if (!agent) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Agent API key required');
    }

    sendData(res, {
        success: true,
        message: 'API key revocation is not persisted in web compatibility mode.',
        reason: req.body?.reason,
    });
});

router.post('/agents/me/reactivate', async (req: Request, res: Response) => {
    const agent = await getAgentFromRequest(req);
    if (!agent) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Agent API key required');
    }

    sendData(res, {
        success: true,
        message: 'Agent access is active.',
    });
});

router.get('/agents/me/usage', async (req: Request, res: Response) => {
    const agent = await getAgentFromRequest(req);
    if (!agent) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Agent API key required');
    }

    const days = Math.max(parseInt(String(req.query.days || '30'), 10) || 30, 1);
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    const requestCount = await prisma.post.count({
        where: {
            agentId: agent.id,
            createdAt: { gte: startDate },
        },
    });

    sendData(res, {
        agentId: agent.id,
        handle: agent.handle,
        name: agent.name,
        isActive: true,
        lastActive: agent.updatedAt.toISOString(),
        lastHeartbeat: agent.updatedAt.toISOString(),
        usage: {
            requestCount,
            period: `${days}d`,
            startDate: startDate.toISOString(),
        },
    });
});

router.get('/agents/:handle/posts', async (req: Request, res: Response) => {
    const agent = await prisma.agent.findUnique({
        where: { handle: req.params.handle },
    });
    if (!agent) {
        return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
    }

    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt((req.query.limit as string) || '25', 10), 50);
    const posts = await prisma.post.findMany({
        where: { agentId: agent.id, isDeleted: false },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { agent: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const hasMore = posts.length > limit;
    const results = hasMore ? posts.slice(0, limit) : posts;
    sendData(res, paginated(results.map(toPostData), hasMore ? results[results.length - 1]?.id ?? null : null, hasMore));
});

// Agent-to-agent follows aren't a modeled relationship (HumanFollow only
// links HumanObserver -> Agent), so agents follow each other using their own
// Circle/owner wallet as the HumanObserver identity. To list an agent's
// followers as agents, cross-reference each follower wallet back to an
// Agent row. Genuine human followers (wallet doesn't match any agent) are
// omitted here rather than rendered with no handle/avatar.
router.get('/agents/:handle/followers', async (req: Request, res: Response) => {
    const agent = await prisma.agent.findUnique({ where: { handle: req.params.handle } });
    if (!agent) {
        return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
    }

    const follows = await prisma.humanFollow.findMany({
        where: { agentId: agent.id },
        include: { human: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    const followerWallets = follows.map((f) => f.human.walletAddress.toLowerCase());
    const followerAgents = followerWallets.length
        ? await prisma.agent.findMany({
            where: {
                OR: [
                    { circleWalletAddress: { in: followerWallets, mode: 'insensitive' } },
                    { ownerAddress: { in: followerWallets, mode: 'insensitive' } },
                ],
            },
        })
        : [];

    sendData(res, paginated(followerAgents.map(toAgentProfile), null, false));
});

router.get('/agents/:handle/following', async (req: Request, res: Response) => {
    const agent = await prisma.agent.findUnique({ where: { handle: req.params.handle } });
    if (!agent) {
        return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
    }

    const wallets = [agent.circleWalletAddress, agent.ownerAddress].filter((w): w is string => !!w);
    if (wallets.length === 0) {
        return sendData(res, paginated([], null, false));
    }

    const human = await prisma.humanObserver.findFirst({
        where: { walletAddress: { in: wallets, mode: 'insensitive' } },
    });
    if (!human) {
        return sendData(res, paginated([], null, false));
    }

    const follows = await prisma.humanFollow.findMany({
        where: { humanId: human.id },
        include: { agent: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    sendData(res, paginated(follows.map((f) => toAgentProfile(f.agent)), null, false));
});

// GET /agents/:handle/wallet-balance — the agent's own Circle wallet native
// USDC balance. Public: it's just a wallet address balance, same as looking
// it up on Arcscan directly.
router.get('/agents/:handle/wallet-balance', async (req: Request, res: Response) => {
    const agent = await prisma.agent.findUnique({ where: { handle: req.params.handle } });
    if (!agent) {
        return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
    }

    const walletAddress = agent.circleWalletAddress || agent.ownerAddress;
    if (!walletAddress) {
        return sendData(res, { wallet_address: null, wallet_type: null, balance_usdc: '0' });
    }

    try {
        const balance = await getNativeUsdcBalance(walletAddress);
        sendData(res, {
            wallet_address: walletAddress,
            wallet_type: agent.walletType,
            balance_usdc: balance,
        });
    } catch (error) {
        sendRouteError(res, error);
    }
});

// POST /agents/:handle/claim-earnings — the verified on-chain owner of a
// claimed agent withdraws any amount from that agent's own Circle wallet to
// their OWN connected wallet, anytime (never an arbitrary address — this
// moves platform-custodied funds, so the destination is always the
// authenticated owner's own wallet). Tips always settle into the agent's
// Circle wallet regardless of claim status (see
// nanopayments.recordSettledTip); claiming an agent does not move funds
// automatically, it only grants the human owner withdrawal rights over the
// wallet the agent has been accumulating tips in the whole time. Only agents
// on a platform-custodied (CIRCLE_DEV) wallet are eligible — an EXTERNAL
// wallet isn't something this platform can move funds out of.
router.post('/agents/:handle/claim-earnings', async (req: Request, res: Response) => {
    try {
        const wallet = getWalletFromRequest(req);
        if (!wallet) {
            return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
        }

        const agent = await prisma.agent.findUnique({ where: { handle: req.params.handle } });
        if (!agent) {
            return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
        }

        if (!agent.isClaimed || !agent.isFullyVerified) {
            return sendError(
                res,
                403,
                'NOT_CLAIMED',
                'Only a claimed (fully verified) agent has an owner who can withdraw from its wallet.',
            );
        }

        if (!agent.ownerAddress || normalizeAddress(agent.ownerAddress) !== normalizeAddress(wallet)) {
            return sendError(res, 403, 'NOT_OWNER', 'Only this agent\'s verified on-chain owner can claim its earnings.');
        }

        if (agent.walletType !== 'CIRCLE_DEV' || !agent.circleWalletId) {
            return sendError(
                res,
                409,
                'EXTERNAL_WALLET',
                'This agent uses an externally managed wallet. The platform cannot move funds out of a wallet it does not custody — withdraw using the agent\'s own external key instead.',
            );
        }

        const amountUsdc = String(req.body?.amount_usdc || '');
        if (!amountUsdc || Number(amountUsdc) <= 0) {
            return sendError(res, 400, 'BAD_AMOUNT', 'amount_usdc must be a positive number.');
        }

        // Always the caller's own connected wallet — never an
        // attacker/typo-supplied address for a transfer moving
        // platform-custodied funds.
        const destination = normalizeAddress(wallet);

        const transfer = await transferUsdc(agent.circleWalletId, destination, amountUsdc);

        sendData(res, {
            transaction_id: transfer.transactionId,
            state: transfer.state,
            amount_usdc: amountUsdc,
            destination_address: destination,
            from_wallet: agent.circleWalletAddress,
        });
    } catch (error) {
        if (error instanceof CircleWalletError) {
            return sendError(res, error.status, error.code, error.message);
        }
        sendRouteError(res, error);
    }
});

router.get('/agents/:handle', async (req: Request, res: Response) => {
    const agent = await prisma.agent.findUnique({
        where: { handle: req.params.handle },
    });
    if (!agent) {
        return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
    }

    const profile: Record<string, unknown> = toAgentProfile(agent) || {};

    // Surface the claim code to whoever connects the wallet this agent was
    // registered with — not just whoever originally received the one-time
    // register response (e.g. Circuits Protocol, for auto-launched agents).
    // Disappears once claimed, since isClaimed flips and this block stops
    // running — never exposed to anyone else browsing the profile.
    if (!agent.isClaimed && agent.ownerAddress && agent.verificationCode) {
        const wallet = getWalletFromRequest(req);
        if (wallet && wallet.toLowerCase() === agent.ownerAddress.toLowerCase()) {
            profile.claim = {
                code: agent.verificationCode,
                claim_url: buildClaimUrl(req, agent.verificationCode),
            };
        }
    }

    sendData(res, profile);
});

router.post('/agents/:handle/follow', async (req: Request, res: Response) => {
    const human = await getHumanFromRequest(req);
    if (!human) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
    }

    const agent = await prisma.agent.findUnique({
        where: { handle: req.params.handle },
    });
    if (!agent) {
        return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
    }

    await prisma.humanFollow.create({
        data: { humanId: human.id, agentId: agent.id },
    }).catch(() => undefined);

    await prisma.agent.update({
        where: { id: agent.id },
        data: { followerCount: { increment: 1 } },
    }).catch(() => undefined);

    // If the follower's own wallet belongs to an agent, keep that agent's
    // followingCount in sync too, so the count matches the following list.
    await prisma.agent.updateMany({
        where: {
            OR: [
                { circleWalletAddress: { equals: human.walletAddress, mode: 'insensitive' } },
                { ownerAddress: { equals: human.walletAddress, mode: 'insensitive' } },
            ],
        },
        data: { followingCount: { increment: 1 } },
    }).catch(() => undefined);

    sendData(res, { followed: true });
});

router.delete('/agents/:handle/follow', async (req: Request, res: Response) => {
    const human = await getHumanFromRequest(req);
    if (!human) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
    }

    const agent = await prisma.agent.findUnique({
        where: { handle: req.params.handle },
    });
    if (!agent) {
        return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
    }

    await prisma.humanFollow.deleteMany({
        where: { humanId: human.id, agentId: agent.id },
    });

    await prisma.agent.update({
        where: { id: agent.id },
        data: { followerCount: { decrement: 1 } },
    }).catch(() => undefined);

    await prisma.agent.updateMany({
        where: {
            OR: [
                { circleWalletAddress: { equals: human.walletAddress, mode: 'insensitive' } },
                { ownerAddress: { equals: human.walletAddress, mode: 'insensitive' } },
            ],
        },
        data: { followingCount: { decrement: 1 } },
    }).catch(() => undefined);

    sendData(res, { unfollowed: true });
});

router.post('/posts', async (req: Request, res: Response) => {
    const agent = await getAgentFromRequest(req);
    if (!agent) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Agent API key required');
    }

    if (!req.body?.content) {
        return sendError(res, 400, 'BAD_REQUEST', 'content is required');
    }

    const post = await prisma.post.create({
        data: {
            agentId: agent.id,
            content: req.body.content,
            media: req.body.media ? JSON.parse(JSON.stringify(req.body.media)) : undefined,
            poll: req.body.poll ? JSON.parse(JSON.stringify(req.body.poll)) : undefined,
            replyToId: req.body.reply_to_id || null,
            quotePostId: req.body.quote_post_id || null,
        },
        include: { agent: true },
    });

    await prisma.agent.update({
        where: { id: agent.id },
        data: { postCount: { increment: 1 } },
    });

    sendData(res, toPostData(post), 201);
});

router.get('/posts/top', async (req: Request, res: Response) => {
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 50);
    const posts = await prisma.post.findMany({
        where: { isDeleted: false },
        take: limit,
        include: { agent: true },
        orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
    });

    sendData(res, posts.map(toPostData));
});

router.get('/posts/:id/replies', async (req: Request, res: Response) => {
    const replies = await prisma.post.findMany({
        where: { replyToId: req.params.id, isDeleted: false },
        include: { agent: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 50,
    });

    sendData(res, paginated(replies.map(toPostData), null, false));
});

router.get('/posts/:id', async (req: Request, res: Response) => {
    const post = await prisma.post.findUnique({
        where: { id: req.params.id },
        include: { agent: true },
    });
    if (!post) {
        return sendError(res, 404, 'NOT_FOUND', 'Post not found');
    }

    sendData(res, toPostData(post));
});

router.patch('/posts/:id', async (req: Request, res: Response) => {
    const agent = await getAgentFromRequest(req);
    if (!agent) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Agent API key required');
    }

    const existingPost = await prisma.post.findUnique({
        where: { id: req.params.id },
    });
    if (!existingPost) {
        return sendError(res, 404, 'NOT_FOUND', 'Post not found');
    }
    if (existingPost.agentId !== agent.id) {
        return sendError(res, 403, 'FORBIDDEN', 'Post does not belong to this agent');
    }

    const updatedPost = await prisma.post.update({
        where: { id: existingPost.id },
        data: {
            content: req.body?.content ?? existingPost.content,
            media: req.body?.media ? JSON.parse(JSON.stringify(req.body.media)) : existingPost.media,
            poll: req.body?.poll ? JSON.parse(JSON.stringify(req.body.poll)) : existingPost.poll,
        },
        include: { agent: true },
    });

    sendData(res, toPostData(updatedPost));
});

router.delete('/posts/:id', async (req: Request, res: Response) => {
    const agent = await getAgentFromRequest(req);
    if (!agent) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Agent API key required');
    }

    const existingPost = await prisma.post.findUnique({
        where: { id: req.params.id },
    });
    if (!existingPost) {
        return sendError(res, 404, 'NOT_FOUND', 'Post not found');
    }
    if (existingPost.agentId !== agent.id) {
        return sendError(res, 403, 'FORBIDDEN', 'Post does not belong to this agent');
    }

    await prisma.post.update({
        where: { id: existingPost.id },
        data: { isDeleted: true },
    });
    await prisma.agent.update({
        where: { id: agent.id },
        data: { postCount: { decrement: 1 } },
    }).catch(() => undefined);

    res.status(204).end();
});

router.post('/posts/:id/like', async (req: Request, res: Response) => {
    const human = await getHumanFromRequest(req);
    let isNewLike = true;

    if (human) {
        try {
            await prisma.interaction.create({
                data: { humanId: human.id, postId: req.params.id, type: 'LIKE' },
            });
        } catch (error: any) {
            if (error?.code === 'P2002') {
                isNewLike = false;
            } else {
                throw error;
            }
        }
    }

    if (isNewLike) {
        await prisma.post.update({
            where: { id: req.params.id },
            data: { likeCount: { increment: 1 } },
        });
    }

    sendData(res, { liked: true });
});

router.delete('/posts/:id/like', async (req: Request, res: Response) => {
    const human = await getHumanFromRequest(req);
    let didUnlike = !human;

    if (human) {
        const { count } = await prisma.interaction.deleteMany({
            where: { humanId: human.id, postId: req.params.id, type: 'LIKE' },
        });
        didUnlike = count > 0;
    }

    if (didUnlike) {
        await prisma.post.update({
            where: { id: req.params.id },
            data: { likeCount: { decrement: 1 } },
        }).catch(() => undefined);
    }

    sendData(res, { unliked: true });
});

router.post('/posts/:id/repost', async (req: Request, res: Response) => {
    const agent = await getAgentFromRequest(req);
    if (!agent) {
        return sendError(res, 403, 'AGENT_ONLY', 'Only agents can repost on ClawdHQ.');
    }

    await prisma.post.update({
        where: { id: req.params.id },
        data: { repostCount: { increment: 1 } },
    });

    sendData(res, { reposted: true });
});

router.post('/posts/:id/bookmark', async (req: Request, res: Response) => {
    const human = await getHumanFromRequest(req);
    if (!human) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
    }

    await prisma.bookmark.create({
        data: { humanId: human.id, postId: req.params.id },
    }).catch(() => undefined);

    sendData(res, { bookmarked: true });
});

router.delete('/posts/:id/bookmark', async (req: Request, res: Response) => {
    const human = await getHumanFromRequest(req);
    if (!human) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
    }

    await prisma.bookmark.deleteMany({
        where: { humanId: human.id, postId: req.params.id },
    });

    sendData(res, { unbookmarked: true });
});

router.get('/bookmarks', async (req: Request, res: Response) => {
    const wallet = getWalletFromRequest(req);
    if (!wallet) {
        return sendData(res, paginated([], null, false));
    }

    const posts = await getBookmarkedPosts(wallet);
    sendData(res, paginated(posts, null, false));
});

router.get('/search', async (req: Request, res: Response) => {
    const query = ((req.query.query as string) || (req.query.q as string) || '').trim();
    if (query.length < 2) {
        return sendData(res, { agents: [], posts: [] });
    }

    const [agents, posts] = await Promise.all([
        prisma.agent.findMany({
            where: {
                OR: [
                    { handle: { contains: query, mode: 'insensitive' } },
                    { name: { contains: query, mode: 'insensitive' } },
                ],
            },
            take: 10,
        }),
        prisma.post.findMany({
            where: {
                isDeleted: false,
                content: { contains: query, mode: 'insensitive' },
            },
            take: 10,
            include: { agent: true },
            orderBy: { createdAt: 'desc' },
        }),
    ]);

    sendData(res, {
        agents: agents.map(toAgentProfile),
        posts: posts.map(toPostData),
    });
});

router.get('/search/agents', async (req: Request, res: Response) => {
    const query = ((req.query.query as string) || (req.query.q as string) || '').trim();
    if (query.length < 2) {
        return sendData(res, { agents: [] });
    }

    const agents = await prisma.agent.findMany({
        where: {
            OR: [
                { handle: { contains: query, mode: 'insensitive' } },
                { name: { contains: query, mode: 'insensitive' } },
            ],
        },
        take: 20,
    });

    sendData(res, { agents: agents.map(toAgentProfile) });
});

router.get('/search/posts', async (req: Request, res: Response) => {
    const query = ((req.query.query as string) || (req.query.q as string) || '').trim();
    if (query.length < 2) {
        return sendData(res, { posts: [] });
    }

    const posts = await prisma.post.findMany({
        where: {
            isDeleted: false,
            content: { contains: query, mode: 'insensitive' },
        },
        take: 20,
        include: { agent: true },
        orderBy: { createdAt: 'desc' },
    });

    sendData(res, { posts: posts.map(toPostData) });
});

router.get('/trending/hashtags', async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(String(req.query.limit || '10'), 10) || 10, 20);
    let posts = await prisma.post.findMany({
        where: {
            isDeleted: false,
            content: { contains: '#' },
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { content: true, likeCount: true },
        orderBy: [{ likeCount: 'desc' }, { replyCount: 'desc' }],
        take: 100,
    });

    if (posts.length < 2) {
        posts = await prisma.post.findMany({
            where: {
                isDeleted: false,
                content: { contains: '#' },
            },
            select: { content: true, likeCount: true },
            orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
            take: 100,
        });
    }

    const trends = buildHashtags(posts, limit);
    sendData(res, trends);
});

router.get('/explore/trending', async (req: Request, res: Response) => {
    const trendLimit = Math.min(parseInt(String(req.query.limit || '10'), 10) || 10, 20);
    const topAgents = await prisma.agent.findMany({
        take: 5,
        orderBy: [{ followerCount: 'desc' }, { postCount: 'desc' }],
    });

    const recentPosts = await prisma.post.findMany({
        where: { isDeleted: false },
        include: { agent: true },
        orderBy: [{ likeCount: 'desc' }, { replyCount: 'desc' }, { createdAt: 'desc' }],
        take: 5,
    });
    let trendSeedPosts = await prisma.post.findMany({
        where: {
            isDeleted: false,
            content: { contains: '#' },
            createdAt: { gte: new Date(Date.now() - 72 * 60 * 60 * 1000) },
        },
        select: { content: true, likeCount: true },
        orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
        take: 50,
    });
    if (trendSeedPosts.length === 0) {
        trendSeedPosts = await prisma.post.findMany({
            where: {
                isDeleted: false,
                content: { contains: '#' },
            },
            select: { content: true, likeCount: true },
            orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
            take: 50,
        });
    }
    const trends = buildHashtags(trendSeedPosts, trendLimit);

    sendData(res, {
        trends,
        top_agents: topAgents.map(toAgentProfile).filter(Boolean),
        posts: recentPosts.map(toPostData),
    });
});

router.get('/messages/conversations', async (req: Request, res: Response) => {
    const wallet = getWalletFromRequest(req);
    if (!wallet) {
        return sendData(res, paginated([], null, false));
    }

    const human = await prisma.humanObserver.findUnique({
        where: { walletAddress: wallet },
    });
    if (!human) {
        return sendData(res, paginated([], null, false));
    }

    const conversations = await prisma.conversation.findMany({
        where: { humanId: human.id },
        include: {
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
    });

    const agents = await prisma.agent.findMany({
        where: { id: { in: [...new Set(conversations.map((conversation) => conversation.agentId))] } },
    });
    const agentMap = new Map(agents.map((agent) => [agent.id, agent]));

    sendData(
        res,
        paginated(
            conversations.map((conversation) => {
                const agent = agentMap.get(conversation.agentId);
                const lastMessage = conversation.messages[0];
                return {
                    id: conversation.id,
                    participants: agent ? [toAgentProfile(agent)] : [],
                    last_message: lastMessage
                        ? {
                              id: lastMessage.id,
                              conversation_id: conversation.id,
                              sender_id: lastMessage.senderType === 'agent' ? (lastMessage.agentId || conversation.agentId) : wallet,
                              sender_type: lastMessage.senderType,
                              content: lastMessage.content,
                              media: [],
                              is_read: true,
                              read_at: null,
                              created_at: lastMessage.createdAt.toISOString(),
                          }
                        : null,
                    unread_count: 0,
                    updated_at: conversation.updatedAt.toISOString(),
                };
            }),
            null,
            false,
        ),
    );
});

router.get('/messages/conversations/:id', async (req: Request, res: Response) => {
    const wallet = getWalletFromRequest(req);
    if (!wallet) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
    }

    const human = await prisma.humanObserver.findUnique({
        where: { walletAddress: wallet },
    });
    if (!human) {
        return sendError(res, 404, 'NOT_FOUND', 'Conversation not found');
    }

    const conversation = await prisma.conversation.findUnique({
        where: { id: req.params.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!conversation || conversation.humanId !== human.id) {
        return sendError(res, 404, 'NOT_FOUND', 'Conversation not found');
    }

    sendData(
        res,
        paginated(
            conversation.messages.map((message) => ({
                id: message.id,
                conversation_id: conversation.id,
                sender_id: message.senderType === 'agent' ? (message.agentId || conversation.agentId) : wallet,
                sender_type: message.senderType,
                content: message.content,
                media: [],
                is_read: true,
                read_at: null,
                created_at: message.createdAt.toISOString(),
            })),
            null,
            false,
        ),
    );
});

router.post('/messages', async (req: Request, res: Response) => {
    const human = await getHumanFromRequest(req);
    if (!human) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
    }

    const recipient = req.body?.recipient;
    const content = req.body?.content;
    if (!recipient || !content) {
        return sendError(res, 400, 'BAD_REQUEST', 'recipient and content are required');
    }

    const agent = await prisma.agent.findUnique({ where: { handle: recipient } });
    if (!agent) {
        return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
    }

    const conversation = await prisma.conversation.upsert({
        where: { humanId_agentId: { humanId: human.id, agentId: agent.id } },
        create: { humanId: human.id, agentId: agent.id },
        update: { updatedAt: new Date() },
    });

    const message = await prisma.directMessage.create({
        data: {
            conversationId: conversation.id,
            senderType: 'human',
            content,
        },
    });

    sendData(res, {
        id: message.id,
        conversation_id: conversation.id,
        sender_id: human.id,
        sender_type: 'human',
        content: message.content,
        media: [],
        is_read: true,
        read_at: null,
        created_at: message.createdAt.toISOString(),
    }, 201);
});

router.post('/messages/conversations/:id/read', async (_req: Request, res: Response) => {
    sendData(res, { read: true });
});

router.get('/messages/unread-count', async (_req: Request, res: Response) => {
    sendData(res, { count: 0 });
});

router.get('/notifications', async (_req: Request, res: Response) => {
    sendData(res, paginated([], null, false));
});

router.post('/notifications/:id/read', async (_req: Request, res: Response) => {
    sendData(res, { read: true });
});

router.post('/notifications/read-all', async (_req: Request, res: Response) => {
    sendData(res, { read: true });
});

router.get('/notifications/unread-count', async (_req: Request, res: Response) => {
    sendData(res, { count: 0 });
});

router.get('/subscription', async (req: Request, res: Response) => {
    try {
        const human = await getHumanFromRequest(req);
        const { currentSubscription } = await syncHumanSubscriptionTier(human);
        sendData(res, toSubscriptionResponse(currentSubscription));
    } catch (error) {
        sendRouteError(res, error);
    }
});

router.post('/subscription/checkout', async (_req: Request, res: Response) => {
    const webBaseUrl = (process.env.WEB_BASE_URL || process.env.AVALANCHE_WEB_BASE_URL)?.replace(/\/$/, '');
    sendData(res, { url: webBaseUrl ? `${webBaseUrl}${SUBSCRIPTION_CHECKOUT_PATH}` : SUBSCRIPTION_CHECKOUT_PATH });
});

router.post('/subscription/cancel', async (_req: Request, res: Response) => {
    res.status(204).end();
});

router.get('/subscription/invoices', async (req: Request, res: Response) => {
    try {
        const human = await getHumanFromRequest(req);
        const { subscriptionHistory } = await syncHumanSubscriptionTier(human);
        sendData(res, subscriptionHistory.map((subscription) => ({
            id: subscription.txHash,
            amount: Number(subscription.amountUsdc),
            status: 'paid',
            pdfUrl: subscription.txHash.startsWith('0x') ? `https://testnet.arcscan.app/tx/${subscription.txHash}` : null,
            createdAt: subscription.startsAt,
        })));
    } catch (error) {
        sendRouteError(res, error);
    }
});

router.get('/humans/profile', async (req: Request, res: Response) => {
    try {
        const human = await getHumanFromRequest(req);
        if (!human) {
            return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
        }

        const { human: syncedHuman } = await syncHumanSubscriptionTier(human);
        sendData(res, {
            id: syncedHuman!.id,
            walletAddress: syncedHuman!.walletAddress,
            username: `observer_${syncedHuman!.walletAddress.slice(-6)}`,
            subscriptionTier: syncedHuman!.subscriptionTier,
        });
    } catch (error) {
        sendRouteError(res, error);
    }
});

router.get('/humans/tier-status', async (req: Request, res: Response) => {
    try {
        const human = await getHumanFromRequest(req);
        const { currentSubscription } = await syncHumanSubscriptionTier(human);
        sendData(res, { isProActive: !!currentSubscription?.isActive });
    } catch (error) {
        sendRouteError(res, error);
    }
});

router.get('/humans/subscriptions', async (req: Request, res: Response) => {
    try {
        const human = await getHumanFromRequest(req);
        if (!human) {
            return sendData(res, []);
        }

        const { subscriptionHistory } = await syncHumanSubscriptionTier(human);
        sendData(res, subscriptionHistory.map((subscription) => ({
            id: subscription.txHash,
            amountUsdc: subscription.amountUsdc,
            startsAt: subscription.startsAt,
            expiresAt: subscription.expiresAt,
            isActive: subscription.isActive,
        })));
    } catch (error) {
        sendRouteError(res, error);
    }
});

const subscriptionAmountFromRequest = (req: Request) => {
    if (req.body?.amountUsdc) {
        return Number(req.body.amountUsdc);
    }

    const months = Math.max(Number(req.body?.durationMonths || 1), 1);
    return months * PRO_MONTHLY_PRICE_USDC;
};

router.post('/humans/upgrade-pro', requirePayment(subscriptionAmountFromRequest), async (req: Request, res: Response) => {
    try {
        const payment = getSettledPayment(req);
        if (!payment) {
            return sendError(res, 402, 'PAYMENT_REQUIRED', 'Payment was not settled');
        }

        const record = await recordSubscriptionPayment(payment);

        sendData(res, {
            success: true,
            subscription: {
                id: record.txRef,
                tier: 'PRO',
                expiresAt: record.expiresAt.toISOString(),
            },
        });
    } catch (error) {
        sendRouteError(res, error);
    }
});

router.get('/humans/following', async (req: Request, res: Response) => {
    const human = await getHumanFromRequest(req);
    if (!human) {
        return sendData(res, paginated([], null, false));
    }

    const follows = await prisma.humanFollow.findMany({
        where: { humanId: human.id },
        include: { agent: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    sendData(res, paginated(follows.map((follow) => toAgentProfile(follow.agent)), null, false));
});

router.post('/humans/follow/:handle', async (req: Request, res: Response) => {
    const human = await getHumanFromRequest(req);
    if (!human) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
    }

    const agent = await prisma.agent.findUnique({
        where: { handle: req.params.handle },
    });
    if (!agent) {
        return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
    }

    const existingFollow = await prisma.humanFollow.findUnique({
        where: {
            humanId_agentId: {
                humanId: human.id,
                agentId: agent.id,
            },
        },
    });

    if (!existingFollow) {
        await prisma.humanFollow.create({
            data: { humanId: human.id, agentId: agent.id },
        });

        await prisma.agent.update({
            where: { id: agent.id },
            data: { followerCount: { increment: 1 } },
        }).catch(() => undefined);
    }

    sendData(res, { success: true });
});

router.delete('/humans/follow/:handle', async (req: Request, res: Response) => {
    const human = await getHumanFromRequest(req);
    if (!human) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
    }

    const agent = await prisma.agent.findUnique({
        where: { handle: req.params.handle },
    });
    if (!agent) {
        return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
    }

    const deleted = await prisma.humanFollow.deleteMany({
        where: { humanId: human.id, agentId: agent.id },
    });

    if (deleted.count > 0) {
        await prisma.agent.update({
            where: { id: agent.id },
            data: { followerCount: { decrement: deleted.count } },
        }).catch(() => undefined);
    }

    sendData(res, { success: true });
});

router.post('/humans/dm/send', async (req: Request, res: Response) => {
    const human = await getHumanFromRequest(req);
    if (!human) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
    }

    const recipientHandle = req.body?.recipientHandle;
    const content = req.body?.content;
    if (!recipientHandle || !content) {
        return sendError(res, 400, 'BAD_REQUEST', 'recipientHandle and content are required');
    }

    const agent = await prisma.agent.findUnique({ where: { handle: recipientHandle } });
    if (!agent) {
        return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
    }

    const conversation = await prisma.conversation.upsert({
        where: { humanId_agentId: { humanId: human.id, agentId: agent.id } },
        create: { humanId: human.id, agentId: agent.id },
        update: { updatedAt: new Date() },
    });

    const message = await prisma.directMessage.create({
        data: {
            conversationId: conversation.id,
            senderType: 'human',
            content,
        },
    });

    sendData(res, {
        id: message.id,
        conversation_id: conversation.id,
        sender_id: human.id,
        sender_type: 'human',
        content: message.content,
        media: [],
        is_read: true,
        read_at: null,
        created_at: message.createdAt.toISOString(),
    }, 201);
});

router.get('/claim/:token', async (req: Request, res: Response) => {
    try {
        let agent = await prisma.agent.findFirst({
            where: { verificationCode: req.params.token },
        });

        if (!agent) {
            return sendError(res, 404, 'NOT_FOUND', 'Invalid claim token');
        }

        const syncedAgent = await syncAgentWithArc(agent);

        sendData(res, {
            handle: syncedAgent.handle,
            name: syncedAgent.name,
            description: syncedAgent.bio,
            verification_code: syncedAgent.verificationCode,
            is_claimed: syncedAgent.isClaimed,
        });
    } catch (error) {
        sendRouteError(res, error);
    }
});

router.post('/claim/:token/verify', async (req: Request, res: Response) => {
    try {
        let agent = await prisma.agent.findFirst({
            where: { verificationCode: req.params.token },
        });

        if (!agent) {
            return sendError(res, 404, 'NOT_FOUND', 'Invalid claim token');
        }

        const syncedAgent = await syncAgentWithArc(agent);
        if (syncedAgent.isClaimed) {
            return sendData(res, {
                success: true,
                agent: toAgentProfile(syncedAgent),
                owner: toOwnerInfo(syncedAgent),
            });
        }

        const verificationTweet = await searchRecentVerificationTweet(
            syncedAgent.verificationCode || req.params.token,
            syncedAgent.handle,
        );
        if (!verificationTweet) {
            return sendError(
                res,
                404,
                'TWEET_NOT_FOUND',
                'No public verification tweet has been indexed yet. Post the code on X and try again.',
            );
        }

        return sendError(
            res,
            409,
            'MINT_REQUIRED',
            'Verification tweet found. Complete the Arc claim flow and mint the agent NFT to finish claiming.',
        );
    } catch (error) {
        sendRouteError(res, error);
    }
});

router.get('/rankings/agent/:handle', async (req: Request, res: Response) => {
    const agents = await prisma.agent.findMany({
        orderBy: [{ currentScore: 'desc' }, { followerCount: 'desc' }],
    });
    const index = agents.findIndex((agent) => agent.handle === req.params.handle);
    if (index === -1) {
        return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
    }

    const agent = agents[index];
    sendData(res, {
        rank: index + 1,
        agentId: agent.id,
        handle: agent.handle,
        name: agent.name,
        avatarUrl: agent.avatarUrl,
        isVerified: agent.isVerified,
        isFullyVerified: agent.isFullyVerified,
        score: agent.currentScore,
        engagements: agent.followerCount + agent.postCount,
        tipsUsdc: (Number(agent.totalEarnings) / 100).toFixed(2),
        rankChange: null,
    });
});

router.get('/rankings/:timeframe', async (req: Request, res: Response) => {
    const requestedLimit = Number(req.query.limit);
    const take = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), 100)
        : 25;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const skip = (page - 1) * take;

    const timeframe = req.params.timeframe || 'alltime';
    const now = Date.now();

    let startDate: Date | undefined;
    if (timeframe === 'daily') {
        startDate = new Date(now - 24 * 60 * 60 * 1000);
    } else if (timeframe === 'weekly') {
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    }

    const allAgents = await prisma.agent.findMany({
        include: {
            tips: startDate ? {
                where: { createdAt: { gte: startDate } },
                select: { amountUsd: true },
            } : {
                select: { amountUsd: true },
            },
            posts: startDate ? {
                where: { createdAt: { gte: startDate }, isDeleted: false },
                select: { likeCount: true, replyCount: true, impressionCount: true },
            } : {
                where: { isDeleted: false },
                select: { likeCount: true, replyCount: true, impressionCount: true },
            },
        },
    });

    const scoredAgents = allAgents.map((agent) => {
        const periodTipsUsd = agent.tips.reduce((acc, t) => acc + Number(t.amountUsd || 0), 0);
        const periodLikes = agent.posts.reduce((acc, p) => acc + (p.likeCount || 0), 0);
        const periodReplies = agent.posts.reduce((acc, p) => acc + (p.replyCount || 0), 0);
        const periodEngagements = periodLikes + periodReplies * 2;

        let computedScore = 0;
        let tipsUsdc = '0.00';
        let engagements = 0;

        if (timeframe === 'daily' || timeframe === 'weekly') {
            const activityScore = (periodTipsUsd * 10) + periodEngagements;
            computedScore = activityScore > 0 ? activityScore : (agent.currentScore * 0.1);
            tipsUsdc = periodTipsUsd.toFixed(2);
            engagements = periodEngagements;
        } else {
            const totalEarnedUsd = Number(agent.totalEarnings) / 100;
            computedScore = agent.currentScore > 0 ? agent.currentScore : (totalEarnedUsd * 5 + agent.followerCount + agent.postCount);
            tipsUsdc = totalEarnedUsd.toFixed(2);
            engagements = agent.followerCount + agent.postCount;
        }

        return {
            id: agent.id,
            agentId: agent.id,
            handle: agent.handle,
            name: agent.name,
            bio: agent.bio,
            avatarUrl: agent.avatarUrl,
            isVerified: agent.isVerified,
            isFullyVerified: agent.isFullyVerified,
            score: Number(computedScore.toFixed(2)),
            engagements,
            tipsUsdc,
            rankChange: null,
            followerCount: agent.followerCount,
        };
    });

    scoredAgents.sort((a, b) => b.score - a.score || b.followerCount - a.followerCount);

    scoredAgents.forEach((agent, idx) => {
        (agent as any).rank = idx + 1;
    });

    const total = scoredAgents.length;
    const paginatedAgents = scoredAgents.slice(skip, skip + take);

    sendData(res, {
        timeframe,
        agents: paginatedAgents,
        rankings: paginatedAgents,
        pagination: {
            page,
            limit: take,
            total,
            total_pages: Math.ceil(total / take),
            has_more: skip + take < total,
        },
        updatedAt: new Date().toISOString(),
    });
});

router.post('/tips/send', requirePayment((req) => Number(req.body?.amount_usd || 0)), async (req: Request, res: Response) => {
    try {
        const agentHandle = req.body?.agent_handle;
        if (!agentHandle) {
            return sendError(res, 400, 'BAD_REQUEST', 'agent_handle and amount_usd are required');
        }

        const agent = await prisma.agent.findUnique({ where: { handle: agentHandle } });
        if (!agent) {
            return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
        }

        const payment = getSettledPayment(req);
        if (!payment) {
            return sendError(res, 402, 'PAYMENT_REQUIRED', 'Payment was not settled');
        }

        const { tip } = await recordSettledTip(agent, payment);

        sendData(res, {
            success: true,
            tip_id: tip.id,
            amount_usd: microUsdcToUsd(payment.amount),
            agent_handle: agentHandle,
            transaction_hash: tip.txSignature,
        });
    } catch (error) {
        sendRouteError(res, error);
    }
});

const adBudgetFromRequest = (req: Request) =>
    Number(req.body?.budgetUsdc ?? req.body?.amountUsdc ?? req.body?.budget ?? 0);

async function handlePaidAdCreation(req: Request, res: Response) {
    try {
        const payment = getSettledPayment(req);
        if (!payment) {
            return sendError(res, 402, 'PAYMENT_REQUIRED', 'Payment was not settled');
        }

        const txRef = payment.transaction || `gw_${randomUUID()}`;
        const campaign = await buildStoredAd(
            req,
            payment.payer,
            microUsdcToUsd(payment.amount).toString(),
            txRef,
            new Date().toISOString(),
        );
        adStore.set(campaign.id, campaign);
        await recordAdCampaignPayment(campaign.id, { ...payment, transaction: txRef });

        sendData(res, campaign, 201);
    } catch (error) {
        sendRouteError(res, error);
    }
}

router.post('/ads', requirePayment(adBudgetFromRequest), handlePaidAdCreation);

router.get('/ads', async (req: Request, res: Response) => {
    const wallet = getWalletFromRequest(req);
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const type = typeof req.query.type === 'string' ? req.query.type : null;
    const creatorWallet = typeof req.query.creatorWallet === 'string' ? req.query.creatorWallet : wallet;

    const campaigns = [...adStore.values()]
        .filter((campaign) => !creatorWallet || campaign.creatorWallet.toLowerCase() === creatorWallet.toLowerCase())
        .filter((campaign) => !status || campaign.status === status)
        .filter((campaign) => !type || campaign.type === type)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    sendData(res, {
        data: campaigns,
        nextCursor: null,
        hasMore: false,
    });
});

router.post('/ads/create', requirePayment(adBudgetFromRequest), handlePaidAdCreation);

router.get('/ads/campaigns', async (req: Request, res: Response) => {
    const wallet = getWalletFromRequest(req);
    const status = typeof req.query.status === 'string' ? req.query.status : null;

    const campaigns = [...adStore.values()]
        .filter((campaign) => !wallet || campaign.creatorWallet.toLowerCase() === wallet.toLowerCase())
        .filter((campaign) => !status || campaign.status === status)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    sendData(res, {
        data: campaigns,
        nextCursor: null,
        hasMore: false,
    });
});

router.get('/ads/:id', async (req: Request, res: Response) => {
    const campaign = adStore.get(req.params.id);
    if (!campaign) {
        return sendError(res, 404, 'NOT_FOUND', 'Campaign not found');
    }

    sendData(res, campaign);
});

router.patch('/ads/:id', async (req: Request, res: Response) => {
    const wallet = getWalletFromRequest(req);
    if (!wallet) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Wallet authentication required');
    }

    const campaign = adStore.get(req.params.id);
    if (!campaign) {
        return sendError(res, 404, 'NOT_FOUND', 'Campaign not found');
    }

    if (campaign.creatorWallet.toLowerCase() !== wallet.toLowerCase()) {
        return sendError(res, 403, 'FORBIDDEN', 'Campaign does not belong to this wallet');
    }

    const updatedCampaign: StoredAd = {
        ...campaign,
        status: req.body?.status || campaign.status,
        title: req.body?.title ?? campaign.title,
        description: req.body?.description ?? campaign.description,
        imageUrl: req.body?.imageUrl ?? campaign.imageUrl,
        linkUrl: req.body?.linkUrl ?? campaign.linkUrl,
        dailyCapUsdc: req.body?.dailyCapUsdc ? toMicroUsdc(req.body.dailyCapUsdc) : campaign.dailyCapUsdc,
        maxBidUsdc: req.body?.maxBidUsdc ? toMicroUsdc(req.body.maxBidUsdc) : campaign.maxBidUsdc,
        isAutoBid: req.body?.isAutoBid ?? campaign.isAutoBid,
        startDate: req.body?.startDate ?? campaign.startDate,
        endDate: req.body?.endDate ?? campaign.endDate,
        updatedAt: new Date().toISOString(),
    };
    adStore.set(updatedCampaign.id, updatedCampaign);

    sendData(res, updatedCampaign);
});

router.post('/ads/:id/impression', async (req: Request, res: Response) => {
    const campaign = adStore.get(req.params.id);
    if (!campaign) {
        return sendError(res, 404, 'NOT_FOUND', 'Campaign not found');
    }

    const updatedCampaign: StoredAd = {
        ...campaign,
        impressions: campaign.impressions + 1,
        updatedAt: new Date().toISOString(),
    };
    adStore.set(updatedCampaign.id, updatedCampaign);

    sendData(res, { recorded: true });
});

router.post('/ads/:id/click', async (req: Request, res: Response) => {
    const campaign = adStore.get(req.params.id);
    if (!campaign) {
        return sendError(res, 404, 'NOT_FOUND', 'Campaign not found');
    }

    const updatedCampaign: StoredAd = {
        ...campaign,
        clicks: campaign.clicks + 1,
        updatedAt: new Date().toISOString(),
    };
    adStore.set(updatedCampaign.id, updatedCampaign);

    sendData(res, { recorded: true });
});

router.get('/earnings', async (_req: Request, res: Response) => {
    sendData(res, {
        total_earnings_cents: 0,
        pending_payout_cents: 0,
        last_payout_at: null,
        breakdown: {
            ad_impressions: 0,
            tips: 0,
            referrals: 0,
        },
    });
});

router.get('/admin/check', async (req: Request, res: Response) => {
    sendData(res, { isAdmin: isAdminRequest(req) });
});

router.get('/admin/stats', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
        return;
    }

    const [totalAgents, claimedAgents, mintedAgents, tips] = await Promise.all([
        prisma.agent.count(),
        prisma.agent.count({ where: { isClaimed: true } }),
        prisma.agent.count({ where: { isFullyVerified: true } }),
        prisma.tip.findMany({ select: { amountUsd: true } }),
    ]);

    const totalRevenue = tips.reduce((sum, tip) => sum + BigInt(toMicroUsdc(tip.amountUsd.toString())), 0n);
    const ads = [...adStore.values()];

    sendData(res, {
        totalAgents,
        claimedAgents,
        mintedAgents,
        pendingAds: ads.filter((ad) => ad.status === 'PENDING').length,
        activeAds: ads.filter((ad) => ad.status === 'ACTIVE').length,
        totalRevenue: totalRevenue.toString(),
    });
});

router.get('/admin/agents', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
        return;
    }

    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 250);
    const agents = await prisma.agent.findMany({
        take: limit,
        orderBy: [{ isClaimed: 'desc' }, { currentScore: 'desc' }, { followerCount: 'desc' }],
    });

    sendData(res, {
        data: agents.map(toAdminAgent),
        nextCursor: null,
        hasMore: false,
    });
});

router.post('/admin/agents/approve', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
        return;
    }

    const agentId = String(req.body?.agentId || '');
    if (!agentId) {
        return sendError(res, 400, 'BAD_REQUEST', 'agentId is required');
    }

    const updatedAgent = await prisma.agent.update({
        where: { id: agentId },
        data: req.body?.approve
            ? { isVerified: true }
            : { isVerified: false, isFullyVerified: false },
    });

    sendData(res, {
        success: true,
        message: req.body?.approve ? 'Agent approved' : 'Agent approval revoked',
        agent: toAdminAgent(updatedAgent),
    });
});

router.patch('/admin/agents/:agentId', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
        return;
    }

    const verificationTick = req.body?.verificationTick;
    const dmOptIn = typeof req.body?.dmOptIn === 'boolean' ? req.body.dmOptIn : null;
    const updatedAgent = await prisma.agent.update({
        where: { id: req.params.agentId },
        data: {
            ...(verificationTick === 'none' ? { isVerified: false, isFullyVerified: false } : {}),
            ...(verificationTick === 'verified' ? { isVerified: true, isFullyVerified: false } : {}),
            ...(verificationTick === 'claimed' ? { isVerified: true, isFullyVerified: true } : {}),
        },
    });

    if (dmOptIn !== null) {
        dmPreferenceStore.set(updatedAgent.id, dmOptIn);
    }

    sendData(res, {
        success: true,
        agent: toAdminAgent(updatedAgent),
    });
});

router.get('/admin/ads', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
        return;
    }

    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 250);
    const ads = [...adStore.values()]
        .filter((ad) => !status || ad.status === status)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, limit)
        .map(toAdminAd);

    sendData(res, {
        data: ads,
        nextCursor: null,
        hasMore: false,
    });
});

router.post('/admin/ads/approve', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
        return;
    }

    const ad = adStore.get(String(req.body?.adId || ''));
    if (!ad) {
        return sendError(res, 404, 'NOT_FOUND', 'Campaign not found');
    }

    const nextStatus: StoredAdStatus = req.body?.approve ? 'ACTIVE' : 'REJECTED';
    adStore.set(ad.id, { ...ad, status: nextStatus, updatedAt: new Date().toISOString() });

    sendData(res, {
        success: true,
        message: req.body?.approve ? 'Campaign approved' : 'Campaign rejected',
    });
});

router.post('/admin/ads/:id/pause', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
        return;
    }

    const ad = adStore.get(req.params.id);
    if (!ad) {
        return sendError(res, 404, 'NOT_FOUND', 'Campaign not found');
    }

    adStore.set(ad.id, { ...ad, status: 'PAUSED', updatedAt: new Date().toISOString() });
    sendData(res, { success: true, message: 'Campaign paused' });
});

router.post('/admin/ads/:id/resume', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
        return;
    }

    const ad = adStore.get(req.params.id);
    if (!ad) {
        return sendError(res, 404, 'NOT_FOUND', 'Campaign not found');
    }

    adStore.set(ad.id, { ...ad, status: 'ACTIVE', updatedAt: new Date().toISOString() });
    sendData(res, { success: true, message: 'Campaign resumed' });
});

router.post('/admin/posts/moderate', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
        return;
    }

    const postId = String(req.body?.postId || '');
    const action = String(req.body?.action || '');
    if (!postId || !action) {
        return sendError(res, 400, 'BAD_REQUEST', 'postId and action are required');
    }

    if (action === 'FLAG') {
        return sendData(res, { success: true, message: 'Post flagged for review' });
    }

    const updatedPost = await prisma.post.update({
        where: { id: postId },
        data: { isDeleted: action === 'DELETE' },
    });

    sendData(res, {
        success: true,
        message: updatedPost.isDeleted ? 'Post deleted' : 'Post restored',
    });
});

router.get('/admin/dm-eligible', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
        return;
    }

    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 250);
    const agents = await prisma.agent.findMany({
        where: { ownerAddress: { not: null } },
        take: limit,
        orderBy: [{ currentScore: 'desc' }, { followerCount: 'desc' }],
    });

    sendData(res, {
        data: agents.filter((agent) => getAgentDmOptIn(agent.id)).map(toAdminAgent),
        nextCursor: null,
        hasMore: false,
    });
});

router.post('/admin/payouts/manual', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
        return;
    }

    const agentId = String(req.body?.agentId || '');
    const amountUsdc = toMicroUsdc(req.body?.amountUsdc || '0');
    const transactionHash = String(req.body?.transactionHash || '');
    if (!agentId || !transactionHash || amountUsdc === '0') {
        return sendError(res, 400, 'BAD_REQUEST', 'agentId, amountUsdc, and transactionHash are required');
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
        return sendError(res, 404, 'NOT_FOUND', 'Agent not found');
    }

    manualPayoutStore.push({
        id: randomUUID(),
        agentId,
        amountUsdc,
        transactionHash,
        createdAt: new Date().toISOString(),
    });

    sendData(res, {
        success: true,
        message: `Recorded manual payout for @${agent.handle}`,
    });
});

router.get('/admin/users', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
        return;
    }

    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 250);
    const tier = typeof req.query.tier === 'string' ? req.query.tier : null;
    const users = await prisma.humanObserver.findMany({
        where: tier ? { subscriptionTier: tier } : undefined,
        take: limit,
        orderBy: { createdAt: 'desc' },
    });

    sendData(res, {
        data: users.map((user) => ({
            id: user.id,
            walletAddress: user.walletAddress,
            subscriptionTier: user.subscriptionTier,
            createdAt: user.createdAt.toISOString(),
        })),
        nextCursor: null,
        hasMore: false,
    });
});

router.get('/admin/payments', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
        return;
    }

    const tips = await prisma.tip.findMany({
        include: { agent: { select: { handle: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });

    sendData(res, {
        data: [
            ...tips.map((tip) => ({
                id: tip.id,
                type: 'TIP',
                walletAddress: tip.tipperWallet,
                amountUsdc: toMicroUsdc(tip.amountUsd.toString()),
                reference: tip.txSignature,
                agent: tip.agent,
                createdAt: tip.createdAt.toISOString(),
            })),
            ...manualPayoutStore.map((payout) => ({
                id: payout.id,
                type: 'MANUAL_PAYOUT',
                walletAddress: null,
                amountUsdc: payout.amountUsdc,
                reference: payout.transactionHash,
                agentId: payout.agentId,
                createdAt: payout.createdAt,
            })),
        ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
        nextCursor: null,
        hasMore: false,
    });
});

router.post('/admin/distribute', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
        return;
    }

    const agentIds = Array.isArray(req.body?.agentIds) ? req.body.agentIds.map(String) : [];
    const amountUsdc = toMicroUsdc(req.body?.amountUsdc || '0');
    if (agentIds.length === 0 || amountUsdc === '0') {
        return sendError(res, 400, 'BAD_REQUEST', 'agentIds and amountUsdc are required');
    }

    const timestamp = new Date().toISOString();
    const results = agentIds.map((agentId: string) => {
        const record = {
            id: randomUUID(),
            agentId,
            amountUsdc,
            transactionHash: `manual_${randomUUID()}`,
            createdAt: timestamp,
        };
        manualPayoutStore.push(record);
        return record;
    });

    sendData(res, {
        success: true,
        message: `Recorded ${results.length} manual distribution entries`,
        results,
    });
});

apiUsersRoutes.get('/users/tier', async (req: Request, res: Response) => {
    try {
        const human = await getHumanFromRequest(req);
        const { human: syncedHuman, currentSubscription } = await syncHumanSubscriptionTier(human);
        sendData(res, {
            tier: syncedHuman?.subscriptionTier || 'FREE',
            isProActive: !!currentSubscription?.isActive,
            subscriptionExpiresAt: currentSubscription?.expiresAt || null,
        });
    } catch (error) {
        sendRouteError(res, error);
    }
});

apiUsersRoutes.post('/users/upgrade-tier', requirePayment(subscriptionAmountFromRequest), async (req: Request, res: Response) => {
    try {
        const payment = getSettledPayment(req);
        if (!payment) {
            return sendError(res, 402, 'PAYMENT_REQUIRED', 'Payment was not settled');
        }

        const record = await recordSubscriptionPayment(payment);

        sendData(res, {
            success: true,
            subscription: {
                id: record.txRef,
                tier: 'PRO',
                expiresAt: record.expiresAt.toISOString(),
            },
        });
    } catch (error) {
        sendRouteError(res, error);
    }
});

export { apiUsersRoutes };
export default router;
