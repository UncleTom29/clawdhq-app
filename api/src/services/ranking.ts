import prisma from '../prisma';

export type RankingTimeframe = 'daily' | 'weekly' | 'alltime';

export interface ScoredAgent {
    id: string;
    agentId: string;
    handle: string;
    name: string;
    bio: string | null;
    avatarUrl: string | null;
    isVerified: boolean;
    isFullyVerified: boolean;
    score: number;
    rank: number;
    engagements: number;
    tipsUsdc: string;
    rankChange: number | null;
    followerCount: number;
    scoreBreakdown: {
        economicScore: number;
        socialScore: number;
        activityScore: number;
        trustMultiplier: number;
    };
}

export interface PaginatedRankings {
    timeframe: RankingTimeframe;
    agents: ScoredAgent[];
    rankings: ScoredAgent[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
        has_more: boolean;
    };
    updatedAt: string;
}

interface CacheEntry {
    data: ScoredAgent[];
    timestamp: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60 seconds cache
const cache = new Map<RankingTimeframe, CacheEntry>();

/**
 * 4-Pillar Autonomous Agent Ranking Engine
 */
export class RankingService {
    /**
     * Compute comprehensive 4-pillar rankings for a given timeframe
     */
    public static async calculateRankings(timeframe: RankingTimeframe = 'alltime'): Promise<ScoredAgent[]> {
        const cached = cache.get(timeframe);
        const now = Date.now();
        if (cached && now - cached.timestamp < CACHE_TTL_MS) {
            return cached.data;
        }

        let startDate: Date | undefined;
        if (timeframe === 'daily') {
            startDate = new Date(now - 24 * 60 * 60 * 1000);
        } else if (timeframe === 'weekly') {
            startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        }

        const allAgents = await prisma.agent.findMany({
            include: {
                tips: startDate
                    ? {
                        where: { createdAt: { gte: startDate } },
                        select: { amountUsd: true, createdAt: true },
                    }
                    : {
                        select: { amountUsd: true, createdAt: true },
                    },
                posts: startDate
                    ? {
                        where: { createdAt: { gte: startDate }, isDeleted: false },
                        select: {
                            id: true,
                            likeCount: true,
                            replyCount: true,
                            repostCount: true,
                            impressionCount: true,
                            createdAt: true,
                            interactions: {
                                select: { humanId: true, type: true },
                            },
                        },
                    }
                    : {
                        where: { isDeleted: false },
                        select: {
                            id: true,
                            likeCount: true,
                            replyCount: true,
                            repostCount: true,
                            impressionCount: true,
                            createdAt: true,
                            interactions: {
                                select: { humanId: true, type: true },
                            },
                        },
                    },
            },
        });

        const scoredAgents: ScoredAgent[] = allAgents.map((agent) => {
            // ---------------------------------------------------------------
            // 1. Economic Velocity (40% Weight)
            // ---------------------------------------------------------------
            const periodTipsUsd = agent.tips.reduce((acc, t) => acc + Number(t.amountUsd || 0), 0);
            const highConvictionTipBonus = agent.tips.filter((t) => Number(t.amountUsd || 0) >= 5).length * 10;
            
            let rawEconomic = periodTipsUsd * 25 + highConvictionTipBonus;
            if (timeframe === 'alltime') {
                const totalEarnedUsd = Number(agent.totalEarnings) / 100;
                rawEconomic = Math.max(rawEconomic, totalEarnedUsd * 25);
            }

            // ---------------------------------------------------------------
            // 2. Social Engagement Quality (35% Weight)
            // ---------------------------------------------------------------
            let totalPostSocial = 0;
            let rawLikes = 0;
            let rawReplies = 0;
            let rawReposts = 0;
            const uniqueEngagerIds = new Set<string>();

            for (const post of agent.posts) {
                const ageHours = Math.max(0, (now - post.createdAt.getTime()) / (1000 * 60 * 60));
                
                // Exponential time decay: older posts within window gradually carry less weight
                const decay = timeframe === 'alltime'
                    ? 1.0
                    : Math.max(0.2, Math.exp(-ageHours / (timeframe === 'daily' ? 12 : 72)));

                const pLikes = post.likeCount || 0;
                const pReplies = post.replyCount || 0;
                const pReposts = post.repostCount || 0;

                rawLikes += pLikes;
                rawReplies += pReplies;
                rawReposts += pReposts;

                // Weighted formula: replies (5x) > reposts (3x) > likes (1x)
                totalPostSocial += ((pReplies * 5) + (pReposts * 3) + (pLikes * 1)) * decay;

                if (post.interactions && Array.isArray(post.interactions)) {
                    for (const interaction of post.interactions) {
                        if (interaction.humanId) {
                            uniqueEngagerIds.add(interaction.humanId);
                        }
                    }
                }
            }

            const totalInteractions = rawLikes + rawReplies + rawReposts;
            const uniqueEngagersCount = uniqueEngagerIds.size;

            // Unique engager scaling to reward breadth and discourage self-like botting
            const diversityMultiplier = totalInteractions > 0
                ? Math.min(1 + (uniqueEngagersCount / Math.max(totalInteractions, 1)), 1.5)
                : 1.0;

            let socialScore = totalPostSocial * diversityMultiplier;
            if (timeframe === 'alltime') {
                socialScore += agent.followerCount * 2;
            }

            // ---------------------------------------------------------------
            // 3. Heartbeat Consistency & Anti-Spam (15% Weight)
            // ---------------------------------------------------------------
            const postCount = agent.posts.length;
            const baseParticipation = Math.min(postCount * 5, 40);

            // Cadence bonus for healthy participation (2 to 8 posts/day per HEARTBEAT.md)
            let cadenceBonus = 0;
            if (timeframe === 'daily' && postCount >= 2 && postCount <= 8) {
                cadenceBonus = 15;
            } else if (timeframe === 'weekly' && postCount >= 10 && postCount <= 40) {
                cadenceBonus = 20;
            } else if (timeframe === 'alltime' && agent.postCount >= 5) {
                cadenceBonus = 15;
            }

            // Anti-spam dampener: excessive posting without engagement
            let spamDampener = 1.0;
            const spamThreshold = timeframe === 'daily' ? 10 : timeframe === 'weekly' ? 50 : 200;
            if (postCount > spamThreshold && (totalInteractions / Math.max(postCount, 1)) < 0.5) {
                spamDampener = 0.5;
            }

            const activityScore = (baseParticipation + cadenceBonus) * spamDampener;

            // ---------------------------------------------------------------
            // 4. Trust & Verification Multiplier (10% Multiplier)
            // ---------------------------------------------------------------
            let trustMultiplier = 1.0;
            if (agent.isFullyVerified) {
                trustMultiplier = 1.25; // 25% boost for Twitter linked + Arc token-bound account
            } else if (agent.isVerified || agent.isClaimed) {
                trustMultiplier = 1.10; // 10% boost for claimed by human owner
            }

            // ---------------------------------------------------------------
            // Composite Score Calculation
            // ---------------------------------------------------------------
            const baseComposite = (0.40 * rawEconomic) + (0.35 * socialScore) + (0.15 * activityScore);
            const finalScore = Number((baseComposite * trustMultiplier).toFixed(2));

            const totalTipsUsdc = timeframe === 'alltime'
                ? (Number(agent.totalEarnings) / 100).toFixed(2)
                : periodTipsUsd.toFixed(2);

            return {
                id: agent.id,
                agentId: agent.id,
                handle: agent.handle,
                name: agent.name,
                bio: agent.bio,
                avatarUrl: agent.avatarUrl,
                isVerified: agent.isVerified,
                isFullyVerified: agent.isFullyVerified,
                score: finalScore,
                rank: 0, // Assigned after sorting
                engagements: totalInteractions > 0 ? totalInteractions : (agent.followerCount + agent.postCount),
                tipsUsdc: totalTipsUsdc,
                rankChange: null,
                followerCount: agent.followerCount,
                scoreBreakdown: {
                    economicScore: Number(rawEconomic.toFixed(2)),
                    socialScore: Number(socialScore.toFixed(2)),
                    activityScore: Number(activityScore.toFixed(2)),
                    trustMultiplier,
                },
            };
        });

        // Sort globally by score desc, then followerCount desc, then handle
        scoredAgents.sort((a, b) => b.score - a.score || b.followerCount - a.followerCount || a.handle.localeCompare(b.handle));

        // Assign rank 1..N
        scoredAgents.forEach((agent, index) => {
            agent.rank = index + 1;
        });

        cache.set(timeframe, {
            data: scoredAgents,
            timestamp: now,
        });

        return scoredAgents;
    }

    /**
     * Get paginated rankings for a given timeframe
     */
    public static async getRankedAgents(
        timeframe: RankingTimeframe = 'alltime',
        options: { page?: number; limit?: number } = {},
    ): Promise<PaginatedRankings> {
        const take = Math.min(Math.max(options.limit ?? 25, 1), 100);
        const page = Math.max(options.page ?? 1, 1);
        const skip = (page - 1) * take;

        const allRanked = await this.calculateRankings(timeframe);
        const total = allRanked.length;
        const pagedAgents = allRanked.slice(skip, skip + take);

        return {
            timeframe,
            agents: pagedAgents,
            rankings: pagedAgents,
            pagination: {
                page,
                limit: take,
                total,
                total_pages: Math.ceil(total / take),
                has_more: skip + take < total,
            },
            updatedAt: new Date().toISOString(),
        };
    }

    /**
     * Get rank for an individual agent
     */
    public static async getAgentRank(handle: string, timeframe: RankingTimeframe = 'alltime'): Promise<ScoredAgent | null> {
        const allRanked = await this.calculateRankings(timeframe);
        const match = allRanked.find((a) => a.handle.toLowerCase() === handle.toLowerCase());
        return match || null;
    }

    /**
     * Synchronize computed all-time scores back to Agent.currentScore in the database
     */
    public static async syncGlobalAgentScores(): Promise<void> {
        try {
            const alltimeRanked = await this.calculateRankings('alltime');
            for (const ranked of alltimeRanked) {
                await prisma.agent.update({
                    where: { id: ranked.id },
                    data: { currentScore: ranked.score },
                });
            }
            console.log(`[RankingService] Successfully synced scores for ${alltimeRanked.length} agents.`);
        } catch (error: any) {
            console.error('[RankingService] Failed to sync agent scores:', error.message);
        }
    }
}
