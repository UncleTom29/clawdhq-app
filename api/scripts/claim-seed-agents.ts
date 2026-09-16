// Real on-chain claim + mint + verify for a few seed agents, using
// ARC_ADMIN_PRIVATE_KEY as the "claiming human" wallet. This is the genuine
// claim flow (reserve -> mint -> admin setVerificationStatus), not a DB flag
// flip — it produces a real AgentRegistry NFT on Arc Testnet owned by this
// key, exactly as a real human claimant would.
//
// Tips still settle into the agent's own Circle wallet regardless of claim
// status (see nanopayments.recordSettledTip) — minting only grants the
// resulting owner withdrawal rights via POST /agents/:handle/claim-earnings.
// It does not move any funds itself.
//
// Run inside the deployed api container (needs DATABASE_URL, AGENT_REGISTRY_ADDRESS,
// ARC_ADMIN_PRIVATE_KEY, ARC_TESTNET_RPC_URL from the environment):
//   docker compose exec api npx tsx scripts/claim-seed-agents.ts arc_scout x402_daily agent_wallet_101
import prisma from '../dist/prisma';
import { buildReservation, reserveAgentWithAdmin, getOnchainAgentState } from '../dist/services/arc';

const { Wallet, Contract, JsonRpcProvider, keccak256, toUtf8Bytes } = require('ethers');

const ARC_CHAIN_ID = Number(process.env.ARC_CHAIN_ID || '5042');
const ARC_RPC_URL =
    process.env.ARC_RPC_URL ||
    process.env.ARC_TESTNET_RPC_URL ||
    (ARC_CHAIN_ID === 5042002 ? 'https://rpc.testnet.arc.network' : 'https://rpc.mainnet.arc.io');
const AGENT_REGISTRY_ADDRESS = process.env.AGENT_REGISTRY_ADDRESS;
const ARC_ADMIN_PRIVATE_KEY = process.env.ARC_ADMIN_PRIVATE_KEY;

const REGISTRY_ABI = [
    'function mintReservedAgent(string agentId, string metadataURI, address desiredPayoutWallet)',
    'function setVerificationStatus(uint256 tokenId, bool _isVerified, bool _isFullyVerified)',
    'function agentKeyToTokenId(bytes32) view returns (uint256)',
];

async function main() {
    if (!AGENT_REGISTRY_ADDRESS || !ARC_ADMIN_PRIVATE_KEY) {
        throw new Error('AGENT_REGISTRY_ADDRESS and ARC_ADMIN_PRIVATE_KEY must be set.');
    }

    const handles = process.argv.slice(2);
    if (handles.length === 0) {
        throw new Error('Usage: tsx scripts/claim-seed-agents.ts <handle> [handle...]');
    }

    const provider = new JsonRpcProvider(ARC_RPC_URL, ARC_CHAIN_ID);
    const adminWallet = new Wallet(ARC_ADMIN_PRIVATE_KEY, provider);
    const registry = new Contract(AGENT_REGISTRY_ADDRESS, REGISTRY_ABI, adminWallet);

    console.log(`[claim-seed] Claiming as ${adminWallet.address}\n`);

    for (const handle of handles) {
        const agent = await prisma.agent.findUnique({ where: { handle } });
        if (!agent) {
            console.log(`[claim-seed] SKIP @${handle}: not found`);
            continue;
        }
        if (agent.isFullyVerified && agent.isClaimed) {
            console.log(`[claim-seed] SKIP @${handle}: already Gold Tick`);
            continue;
        }

        console.log(`[claim-seed] @${handle} (${agent.id})`);

        const reservation = buildReservation(
            agent.id,
            adminWallet.address,
            agent.verificationCode || 'seed',
            `seed-claim-${agent.id}`,
        );
        const reserveResult = await reserveAgentWithAdmin(agent.id, reservation);
        console.log(`  reserved: ${reserveResult.txHash}`);

        const metadataURI = `ipfs://clawdhq-seed/${agent.handle}`;
        const mintTx = await registry.mintReservedAgent(agent.id, metadataURI, adminWallet.address);
        const mintReceipt = await mintTx.wait();
        if (!mintReceipt || mintReceipt.status !== 1) {
            throw new Error(`Mint failed for @${handle}: ${mintTx.hash}`);
        }
        console.log(`  minted: ${mintTx.hash}`);

        const agentKey = keccak256(toUtf8Bytes(agent.id));
        const tokenId = await registry.agentKeyToTokenId(agentKey);
        const verifyTx = await registry.setVerificationStatus(tokenId, true, true);
        await verifyTx.wait();
        console.log(`  verified: tokenId ${tokenId.toString()}, Gold Tick set on-chain`);

        const onchainState = await getOnchainAgentState(agent.id);
        await prisma.agent.update({
            where: { id: agent.id },
            data: {
                isClaimed: true,
                isVerified: onchainState.isVerified,
                isFullyVerified: onchainState.isFullyVerified,
                ownerAddress: onchainState.owner,
            },
        });
        console.log(`  synced: @${handle} is now Gold Tick, owner=${onchainState.owner}\n`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[claim-seed] fatal error:', err);
        process.exit(1);
    });
