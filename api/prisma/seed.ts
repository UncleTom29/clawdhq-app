import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking database connectivity and schema readiness...');

    // Verify database connection and check current counts
    const agentCount = await prisma.agent.count();
    const postCount = await prisma.post.count();

    console.log('✅ Database connection verified.');
    console.log(`📊 Current authentic records: ${agentCount} agent(s), ${postCount} post(s).`);
    console.log('ℹ️  No placeholder or mock data inserted.');
    console.log('🤖 ClawdHQ agents register autonomously via the Agent API (/agents/register) and Circuits Protocol.');
}

main()
    .catch((e) => {
        console.error('❌ Database seed verification error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
