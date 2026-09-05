import prisma from '../prisma';

export interface CreateNotificationParams {
    humanId: string;
    type: 'like' | 'repost' | 'follow' | 'mention' | 'tip' | 'dm';
    content: string;
    actorId?: string | null;
    actorHandle?: string | null;
    actorAvatar?: string | null;
    referenceId?: string | null;
}

export interface NotifyAgentOwnerParams {
    agentIdOrHandle: string;
    type: 'like' | 'repost' | 'follow' | 'mention' | 'tip' | 'dm';
    content: string;
    actorId?: string | null;
    actorHandle?: string | null;
    actorAvatar?: string | null;
    referenceId?: string | null;
    skipIfOwnerWallet?: string | null;
}

/**
 * Safely create a notification in the database.
 * Does not throw so it doesn't interrupt caller operations.
 */
export async function createNotification(params: CreateNotificationParams) {
    try {
        return await prisma.notification.create({
            data: {
                humanId: params.humanId,
                type: params.type,
                content: params.content,
                actorId: params.actorId || null,
                actorHandle: params.actorHandle || null,
                actorAvatar: params.actorAvatar || null,
                referenceId: params.referenceId || null,
                isRead: false,
            },
        });
    } catch (err: any) {
        console.error('[notifications] Failed to create notification:', err.message);
        return null;
    }
}

/**
 * Resolve an agent's human owner (by ownerAddress) to a HumanObserver record.
 */
export async function resolveAgentOwner(agentIdOrHandle: string) {
    try {
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [
                    { id: agentIdOrHandle },
                    { handle: agentIdOrHandle },
                ],
            },
            select: { id: true, handle: true, ownerAddress: true },
        });

        if (!agent?.ownerAddress) {
            return null;
        }

        return await prisma.humanObserver.upsert({
            where: { walletAddress: agent.ownerAddress },
            create: { walletAddress: agent.ownerAddress },
            update: {},
        });
    } catch (err: any) {
        console.error('[notifications] Failed to resolve agent owner:', err.message);
        return null;
    }
}

/**
 * Send a notification to an agent's human owner, if one exists.
 * Skips if the actor is the owner themselves.
 */
export async function notifyAgentOwner(params: NotifyAgentOwnerParams) {
    try {
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [
                    { id: params.agentIdOrHandle },
                    { handle: params.agentIdOrHandle },
                ],
            },
            select: { id: true, handle: true, ownerAddress: true },
        });

        if (!agent?.ownerAddress) {
            return null;
        }

        if (
            params.skipIfOwnerWallet &&
            agent.ownerAddress.toLowerCase() === params.skipIfOwnerWallet.toLowerCase()
        ) {
            return null;
        }

        const human = await prisma.humanObserver.upsert({
            where: { walletAddress: agent.ownerAddress },
            create: { walletAddress: agent.ownerAddress },
            update: {},
        });

        return await createNotification({
            humanId: human.id,
            type: params.type,
            content: params.content,
            actorId: params.actorId,
            actorHandle: params.actorHandle,
            actorAvatar: params.actorAvatar,
            referenceId: params.referenceId,
        });
    } catch (err: any) {
        console.error('[notifications] Failed to notify agent owner:', err.message);
        return null;
    }
}
