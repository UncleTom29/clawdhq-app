import { PrismaClient } from '@prisma/client';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';

const prisma = new PrismaClient();

const API_BASE_URL = process.env.ONBOARDING_API_URL || 'http://127.0.0.1:4100/api/v1';
const TWEET_URL = 'https://x.com/DecagonAI/status/2014388744451981788';
const TEST_HANDLE = 'openai';
const TEST_NAME = 'OpenAI Smoke Test';
const TEST_CODE = '@OpenAI';

const registryAbi = [
  'function reserveAgent(string agentId, bytes32 reservationHash, uint256 expiry, address authorizedWallet)',
  'function mintReservedAgent(string agentId, string metadataURI, address desiredPayoutWallet)',
];

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers || {}),
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(payload.error || payload));
  }

  return ('data' in payload ? payload.data : payload) as T;
}

async function cleanupExistingSmokeAgent() {
  const existingAgent = await prisma.agent.findUnique({ where: { handle: TEST_HANDLE } });
  if (!existingAgent) {
    return;
  }

  if (existingAgent.name !== TEST_NAME) {
    throw new Error(`Handle @${TEST_HANDLE} already exists and is not a disposable smoke agent.`);
  }

  await prisma.tip.deleteMany({ where: { agentId: existingAgent.id } });
  await prisma.interaction.deleteMany({ where: { post: { agentId: existingAgent.id } } });
  await prisma.bookmark.deleteMany({ where: { postId: { in: (await prisma.post.findMany({ where: { agentId: existingAgent.id }, select: { id: true } })).map((post) => post.id) } } });
  await prisma.post.deleteMany({ where: { agentId: existingAgent.id } });
  await prisma.humanFollow.deleteMany({ where: { agentId: existingAgent.id } });
  await prisma.conversation.deleteMany({ where: { agentId: existingAgent.id } });
  await prisma.directMessage.deleteMany({ where: { agentId: existingAgent.id } });
  await prisma.agent.delete({ where: { id: existingAgent.id } });
}

async function main() {
  const rpcUrl = process.env.ARC_TESTNET_RPC_URL;
  const adminPrivateKey = process.env.ARC_ADMIN_PRIVATE_KEY;
  const registryAddress = process.env.AGENT_REGISTRY_ADDRESS;

  if (!rpcUrl || !adminPrivateKey || !registryAddress) {
    throw new Error('ARC_TESTNET_RPC_URL, ARC_ADMIN_PRIVATE_KEY, and AGENT_REGISTRY_ADDRESS are required.');
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(adminPrivateKey, provider);
  const registry = new Contract(registryAddress, registryAbi, wallet);

  await cleanupExistingSmokeAgent();

  let createdAgentId: string | null = null;

  try {
    console.log('1. Registering disposable smoke agent...');
    const registration = await apiRequest<{
      success: boolean;
      agent: { id: string; handle: string; api_key: string; claim_url: string; verification_code: string };
    }>('/agents/register', {
      method: 'POST',
      body: JSON.stringify({
        handle: TEST_HANDLE,
        name: TEST_NAME,
        description: 'Disposable Arc onboarding integration test agent.',
        owner_address: wallet.address,
      }),
    });

    createdAgentId = registration.agent.id;
    console.log('   Agent ID:', createdAgentId);

    console.log('2. Overriding verification code for reproducible Twitter verification...');
    await prisma.agent.update({
      where: { id: createdAgentId },
      data: { verificationCode: TEST_CODE },
    });

    console.log('3. Initiating claim session...');
    const claimInit = await apiRequest<{
      agent: { id: string; handle: string; name: string };
      verificationCode: string;
      verificationText: string;
      expiresAt: string;
    }>('/agents/claim', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress: wallet.address,
        claimCode: TEST_CODE,
      }),
    });
    console.log('   Verification text:', claimInit.verificationText);

    console.log('4. Verifying public tweet and reserving on Arc...');
    const verifyTweet = await apiRequest<{
      success: boolean;
      agent: { id: string; handle: string; name: string; status: string };
      tweet: { id: string; text: string };
      reservationTxHash?: string;
      reservationParams?: {
        agentId: string;
        reservationHash: string;
        expiryTimestamp: string;
        authorizedWallet: string;
      };
    }>('/agents/verify-tweet', {
      method: 'POST',
      body: JSON.stringify({
        agentId: createdAgentId,
        tweetUrl: TWEET_URL,
        walletAddress: wallet.address,
      }),
    });
    console.log('   Tweet ID:', verifyTweet.tweet.id);
    console.log('   Reservation status:', verifyTweet.agent.status);

    if (verifyTweet.reservationParams) {
      console.log('   Backend returned reservation params, sending reserveAgent from the wallet...');
      const reserveTx = await registry.reserveAgent(
        verifyTweet.reservationParams.agentId,
        verifyTweet.reservationParams.reservationHash,
        BigInt(verifyTweet.reservationParams.expiryTimestamp),
        verifyTweet.reservationParams.authorizedWallet
      );
      await reserveTx.wait();
      console.log('   Reservation tx hash:', reserveTx.hash);
    } else if (verifyTweet.reservationTxHash) {
      console.log('   Reservation tx hash:', verifyTweet.reservationTxHash);
    }

    console.log('5. Minting reserved agent NFT on Arc...');
    const metadataUri = `ipfs://clawdhq-arc-smoke/${createdAgentId}`;
    const mintTx = await registry.mintReservedAgent(createdAgentId, metadataUri, wallet.address);
    await mintTx.wait();
    console.log('   Mint tx hash:', mintTx.hash);

    console.log('6. Finalizing claim through the backend...');
    const finalize = await apiRequest<{
      success: boolean;
      transactionHash: string;
      tokenId: string;
      mintedAt: string;
      agent: { id: string; handle: string; is_claimed: boolean; is_fully_verified: boolean };
    }>('/agents/claim/finalize', {
      method: 'POST',
      body: JSON.stringify({
        agentId: createdAgentId,
        walletAddress: wallet.address,
        transactionHash: mintTx.hash,
      }),
    });
    console.log('   Token ID:', finalize.tokenId);
    console.log('   Finalized at:', finalize.mintedAt);

    console.log('7. Verifying claimed agent profile...');
    const profile = await apiRequest<{ id: string; handle: string; is_claimed: boolean; is_verified: boolean; owner_wallet: string | null }>(
      `/agents/${TEST_HANDLE}`
    );
    console.log('   Claimed:', profile.is_claimed, 'Verified:', profile.is_verified, 'Owner:', profile.owner_wallet);

    console.log('8. Cleaning up the disposable smoke agent from Postgres...');
    await prisma.agent.delete({ where: { id: createdAgentId } });
    createdAgentId = null;

    console.log('Onboarding smoke test completed successfully.');
  } finally {
    if (createdAgentId) {
      await prisma.agent.deleteMany({ where: { id: createdAgentId } });
    }

    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
