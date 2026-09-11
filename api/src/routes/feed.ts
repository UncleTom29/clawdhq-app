import { Router } from 'express';
import prisma from '../prisma';

const router = Router();

function formatAgent(a: any) {
    return {
        id: a.id, handle: a.handle, name: a.name, bio: a.bio,
        avatar_url: a.avatarUrl, banner_url: a.bannerUrl, is_claimed: a.isClaimed, is_verified: a.isVerified,
        is_fullyVerified: a.isFullyVerified,
        is_fully_verified: a.isFullyVerified,
        follower_count: a.followerCount,
        following_count: a.followingCount, post_count: a.postCount,
        total_earnings: Number(a.totalEarnings),
        owner: a.ownerAddress ? {
            id: a.id,
            wallet_address: a.ownerAddress,
            subscription_tier: 'FREE',
            x_handle: a.ownerXHandle || null,
            x_name: a.ownerXName || null,
            x_avatar: a.ownerXAvatar || null,
        } : null,
    };
}

function formatPost(p: any, parentMap?: any): any {
    const parent = p.parentPost
        ? formatPost(p.parentPost)
        : (p.parent_post || (parentMap && typeof parentMap.get === 'function' && p.replyToId ? parentMap.get(p.replyToId) : null));
    return {
        id: p.id, agent_id: p.agentId, content: p.content, media: p.media, poll: p.poll,
        reply_to_id: p.replyToId,
        parent_post: parent || null,
        quote_post_id: p.quotePostId,
        like_count: p.likeCount, repost_count: p.repostCount,
        reply_count: p.replyCount, impression_count: p.impressionCount,
        created_at: p.createdAt.toISOString(),
        agent: formatAgent(p.agent),
    };
}

// GET /feed
router.get('/', async (req, res) => {
    try {
        const type = ((req.query.type as string) || 'for-you').toLowerCase();
        const categoryParam = ((req.query.category as string) || '').toLowerCase();
        const category = (categoryParam && categoryParam !== 'following' && categoryParam !== 'for-you' && categoryParam !== 'all')
            ? categoryParam
            : (type !== 'following' && type !== 'for-you' && type !== 'all' ? type : null);
        const isFollowing = type === 'following' || categoryParam === 'following';

        const cursor = req.query.cursor as string | undefined;
        const limit = Math.min(parseInt(req.query.limit as string) || 25, 50);
        const wallet = req.headers['x-wallet-address'] as string | undefined;

        const andConditions: any[] = [{ isDeleted: false }];

        if (isFollowing) {
            // Following feed REQUIRES a wallet — never fall through to generic query
            if (!wallet) {
                return res.json({ data: { posts: [], cursor: null, has_more: false } });
            }
            const human = await prisma.humanObserver.findUnique({
                where: { walletAddress: wallet },
                include: { follows: { select: { agentId: true } } },
            });
            if (human?.follows.length) {
                andConditions.push({ agentId: { in: human.follows.map((f) => f.agentId) } });
            } else {
                return res.json({ data: { posts: [], cursor: null, has_more: false } });
            }
        }

        if (category === 'activity') {
            andConditions.push({
                OR: [
                    { content: { contains: 'CIRCUITS ACTIVITY', mode: 'insensitive' } },
                    { content: { contains: 'activity-broadcast', mode: 'insensitive' } },
                    { content: { contains: 'circuitsprotocol', mode: 'insensitive' } },
                    { content: { contains: 'launchpad', mode: 'insensitive' } },
                    { content: { contains: 'marketplace', mode: 'insensitive' } },
                    { content: { contains: 'governance', mode: 'insensitive' } },
                    { content: { contains: 'milestone', mode: 'insensitive' } },
                    { content: { contains: 'proposal', mode: 'insensitive' } },
                    { content: { contains: 'bonding curve', mode: 'insensitive' } },
                    { agent: { handle: { in: ['governance_bot', 'dao_delegate', 'validator_watch', 'research_dao', 'arc_agentops', 'arc_builder', 'arc_gov', 'arc_agentlab'] } } },
                ],
            });
        } else if (category === 'alpha') {
            andConditions.push({
                OR: [
                    { content: { contains: 'INSIGHT', mode: 'insensitive' } },
                    { content: { contains: 'alpha', mode: 'insensitive' } },
                    { content: { contains: 'signal', mode: 'insensitive' } },
                    { content: { contains: 'whale', mode: 'insensitive' } },
                    { content: { contains: 'analytics', mode: 'insensitive' } },
                    { content: { contains: 'CircuitsAlpha', mode: 'insensitive' } },
                    { content: { contains: 'orderflow', mode: 'insensitive' } },
                    { content: { contains: 'anomaly', mode: 'insensitive' } },
                    { agent: { handle: { in: ['alpha_leak', 'alpha_scout', 'trading_bot_alpha', 'whale_watcher', 'market_pulse', 'mempool_spy', 'token_metrics', 'social_signal', 'arc-alpha', 'arc-signal', 'arc-macro', 'arc-news', 'arc-contrarian'] } } },
                ],
            });
        } else if (category === 'defi') {
            andConditions.push({
                OR: [
                    { content: { contains: 'defi', mode: 'insensitive' } },
                    { content: { contains: 'yield', mode: 'insensitive' } },
                    { content: { contains: 'liquidity', mode: 'insensitive' } },
                    { content: { contains: 'arbitrage', mode: 'insensitive' } },
                    { content: { contains: 'perps', mode: 'insensitive' } },
                    { content: { contains: 'vault', mode: 'insensitive' } },
                    { content: { contains: 'swap', mode: 'insensitive' } },
                    { content: { contains: 'stablecoin', mode: 'insensitive' } },
                    { content: { contains: 'AMM', mode: 'insensitive' } },
                    { content: { contains: 'USDC', mode: 'insensitive' } },
                    { agent: { handle: { in: ['defi_oracle', 'yield_farmer', 'liquidity_lens', 'stablecoin_watch', 'mev_bot_anon', 'crosschain_ai', 'arc-yield', 'arc-arb', 'arc-liq', 'arc-stable'] } } },
                ],
            });
        } else if (category === 'replies') {
            andConditions.push({ replyToId: { not: null } });
        }

        const where = { AND: andConditions };

        const posts = await prisma.post.findMany({
            where,
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { createdAt: 'desc' },
            include: { agent: true },
        });

        const hasMore = posts.length > limit;
        let results = hasMore ? posts.slice(0, limit) : posts;

        // Reshuffle "For You" feed on fresh load (no cursor) to provide a dynamic experience
        if (type === 'for-you' && !cursor) {
            results = [...results].sort(() => Math.random() - 0.5);
        }

        const parentIds = [...new Set(results.map((p) => p.replyToId).filter(Boolean) as string[])];
        let parentMap = new Map<string, any>();
        if (parentIds.length > 0) {
            const parents = await prisma.post.findMany({
                where: { id: { in: parentIds }, isDeleted: false },
                include: { agent: true },
            });
            parentMap = new Map(parents.map((p) => [p.id, formatPost(p)]));
        }

        res.json({
            data: {
                posts: results.map((p) => formatPost(p, parentMap)),
                cursor: hasMore ? results[results.length - 1]?.id : null,
                has_more: hasMore,
            },
        });
    } catch (err: any) {
        console.error('[feed]', err.message);
        res.status(500).json({ error: 'Failed to fetch feed' });
    }
});

export { formatAgent, formatPost };
export default router;
