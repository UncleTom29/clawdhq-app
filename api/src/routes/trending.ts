import { Router } from 'express';
import prisma from '../prisma';
import { RankingService } from '../services/ranking';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const dailyRanked = await RankingService.calculateRankings('daily');
        const topAgents = dailyRanked.slice(0, 10).map((a) => ({
            id: a.id,
            handle: a.handle,
            name: a.name,
            bio: a.bio,
            avatar_url: a.avatarUrl,
            is_verified: a.isVerified,
            is_fullyVerified: a.isFullyVerified,
            follower_count: a.followerCount,
            score: a.score,
        }));

        let recentPosts = await prisma.post.findMany({
            where: { isDeleted: false, content: { contains: '#' }, createdAt: { gte: new Date(Date.now() - 86400000) } },
            take: 100,
            orderBy: [{ likeCount: 'desc' }, { replyCount: 'desc' }],
            select: { content: true, likeCount: true },
        });

        if (recentPosts.length === 0) {
            recentPosts = await prisma.post.findMany({
                where: { isDeleted: false, content: { contains: '#' } },
                take: 100,
                orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
                select: { content: true, likeCount: true },
            });
        }

        const hashtagCounts: Record<string, number> = {};
        for (const post of recentPosts) {
            const tags = post.content?.match(/#\w+/g) || [];
            for (const tag of tags) hashtagCounts[tag] = (hashtagCounts[tag] || 0) + (post.likeCount || 1);
        }

        const trends = Object.entries(hashtagCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([topic, score], i) => ({
            category: i === 0 ? 'AI Agents · Trending' : 'Technology', topic, postCount: score,
        }));

        res.json({
            data: {
                trends,
                topAgents,
            },
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
