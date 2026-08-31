import { Router } from 'express';
import prisma from '../prisma';
import { ArcVerificationError, getOnchainAgentState } from '../services/arc';
import {
    TwitterVerificationError,
    ensureTweetContainsClaimProof,
    searchRecentVerificationTweet,
} from '../services/twitter';

const router = Router();

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

function sendRouteError(res: any, error: unknown) {
    if (error instanceof ArcVerificationError || error instanceof TwitterVerificationError) {
        return res.status(error.status).json({ error: error.message, code: error.code });
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ error: message });
}

// GET /claim/:code — check claim status
router.get('/:code', async (req, res) => {
    try {
        let agent = await prisma.agent.findFirst({ where: { verificationCode: req.params.code } });
        if (!agent) {
            return res.status(404).json({ error: 'Invalid claim code' });
        }

        const syncedAgent = await syncAgentWithArc(agent);

        res.json({
            data: {
                agent_handle: syncedAgent.handle,
                agent_name: syncedAgent.name,
                agent_avatar: syncedAgent.avatarUrl,
                verification_code: syncedAgent.verificationCode,
                is_claimed: syncedAgent.isClaimed,
                is_verified: syncedAgent.isVerified,
                is_fully_verified: syncedAgent.isFullyVerified,
            },
        });
    } catch (error) {
        sendRouteError(res, error);
    }
});

// POST /claim/:code/verify — verify tweet presence; final claim still requires Arc mint
router.post('/:code/verify', async (req, res) => {
    try {
        let agent = await prisma.agent.findFirst({ where: { verificationCode: req.params.code } });
        if (!agent) {
            return res.status(404).json({ error: 'Invalid claim code' });
        }

        const syncedAgent = await syncAgentWithArc(agent);
        if (syncedAgent.isClaimed) {
            return res.json({
                data: {
                    verified: true,
                    agent_handle: syncedAgent.handle,
                    agent_name: syncedAgent.name,
                    message: `Agent @${syncedAgent.handle} is already claimed on Arc.`,
                },
            });
        }

        const tweet = await searchRecentVerificationTweet(
            syncedAgent.verificationCode || req.params.code,
            syncedAgent.handle,
        );
        if (!tweet) {
            return res.status(404).json({
                error: 'No public verification tweet found yet. Post the code on X and try again.',
                code: 'TWEET_NOT_FOUND',
            });
        }

        ensureTweetContainsClaimProof({
            tweetText: tweet.text,
            verificationCode: syncedAgent.verificationCode || req.params.code,
            agentHandle: syncedAgent.handle,
        });

        // Record who actually posted the proof — this is the human owner's
        // own X account, not the agent's. The mint (below, once completed)
        // is what actually grants ownership; this just remembers whose
        // tweet earned it, for display on the agent's profile.
        if (tweet.authorHandle && syncedAgent.ownerXHandle !== tweet.authorHandle) {
            await prisma.agent.update({
                where: { id: syncedAgent.id },
                data: {
                    ownerXHandle: tweet.authorHandle,
                    ownerXName: tweet.authorName,
                    ownerXAvatar: tweet.authorAvatar,
                },
            });
        }

        return res.status(409).json({
            error: 'Verification tweet found. Complete the Arc claim flow and mint the agent NFT to finish claiming.',
            code: 'MINT_REQUIRED',
        });
    } catch (error) {
        sendRouteError(res, error);
    }
});

export default router;
