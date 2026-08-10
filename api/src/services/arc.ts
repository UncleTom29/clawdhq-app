// Arc Testnet (Circle's L1) chain integration for the AgentRegistry claim flow.
// Payments no longer touch this module — tips, subscriptions, and ad campaigns
// settle through Circle Gateway nanopayments (see services/nanopayments.ts).
//
// Use runtime require so TypeScript does not follow ethers source files during server builds.
const {
    Contract,
    Interface,
    JsonRpcProvider,
    Wallet,
    formatEther,
    getAddress,
    isAddress,
    keccak256,
    solidityPackedKeccak256,
    toUtf8Bytes,
} = require('ethers');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ARC_TESTNET_CHAIN_ID = 5042002n;
const ARC_TESTNET_RPC_URL =
    process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network';
const AGENT_REGISTRY_ADDRESS = process.env.AGENT_REGISTRY_ADDRESS || ZERO_ADDRESS;
const ARC_ADMIN_PRIVATE_KEY =
    process.env.ARC_ADMIN_PRIVATE_KEY || process.env.AVALANCHE_ADMIN_PRIVATE_KEY || '';

export const ARC_EXPLORER_TX_URL = 'https://testnet.arcscan.app/tx';
export const ARC_EXPLORER_ADDRESS_URL = 'https://testnet.arcscan.app/address';

const provider = new JsonRpcProvider(ARC_TESTNET_RPC_URL, Number(ARC_TESTNET_CHAIN_ID));

const agentRegistryAbi = [
    'function agentKeyToTokenId(bytes32) view returns (uint256)',
    'function ownerOf(uint256) view returns (address)',
    'function payoutWallets(uint256) view returns (address)',
    'function isVerified(uint256) view returns (bool)',
    'function isFullyVerified(uint256) view returns (bool)',
    'function reserveAgent(string agentId, bytes32 reservationHash, uint256 expiry, address authorizedWallet)',
    'function mintReservedAgent(string agentId, string metadataURI, address desiredPayoutWallet)',
    'function setVerificationStatus(uint256 tokenId, bool _isVerified, bool _isFullyVerified)',
    'event AgentReserved(string indexed agentId, bytes32 reservationHash, uint256 expiresAt, address indexed authorizedWallet)',
    'event AgentMinted(string indexed agentId, uint256 indexed tokenId, address indexed owner, address payoutWallet)',
] as const;

const agentRegistryInterface = new Interface(agentRegistryAbi);

export class ArcVerificationError extends Error {
    code: string;
    status: number;

    constructor(code: string, message: string, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

export interface OnchainAgentState {
    minted: boolean;
    tokenId: bigint;
    owner: string | null;
    payoutWallet: string | null;
    isVerified: boolean;
    isFullyVerified: boolean;
}

export interface ClaimReservation {
    reservationHash: string;
    expiryTimestamp: bigint;
    authorizedWallet: string;
}

export interface VerifiedMintTransaction {
    txHash: string;
    agentId: string;
    owner: string;
    payoutWallet: string;
    metadataUri: string;
    tokenId: bigint;
    isVerified: boolean;
    isFullyVerified: boolean;
    mintedAt: string;
}

function ensureAddress(address: string, label: string): string {
    if (!isAddress(address) || address === ZERO_ADDRESS) {
        throw new ArcVerificationError(
            'CHAIN_NOT_CONFIGURED',
            `${label} is not configured for Arc Testnet.`,
            503,
        );
    }

    return getAddress(address);
}

function getAgentRegistry() {
    return new Contract(
        ensureAddress(AGENT_REGISTRY_ADDRESS, 'AGENT_REGISTRY_ADDRESS'),
        agentRegistryAbi,
        provider,
    );
}

function getAdminSigner() {
    if (!ARC_ADMIN_PRIVATE_KEY) {
        throw new ArcVerificationError(
            'ADMIN_SIGNER_NOT_CONFIGURED',
            'ARC_ADMIN_PRIVATE_KEY is required for backend-triggered reservations.',
            503,
        );
    }

    return new Wallet(ARC_ADMIN_PRIVATE_KEY, provider);
}

function ensureTxHash(txHash: string): string {
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
        throw new ArcVerificationError('INVALID_TX_HASH', 'A valid Arc transaction hash is required.');
    }

    return txHash;
}

async function getVerifiedTransaction(txHash: string) {
    const normalizedHash = ensureTxHash(txHash);

    const [tx, receipt] = await Promise.all([
        provider.getTransaction(normalizedHash),
        provider.getTransactionReceipt(normalizedHash),
    ]);

    if (!tx || !receipt) {
        throw new ArcVerificationError(
            'TX_NOT_FOUND',
            'The Arc Testnet transaction could not be found yet.',
            404,
        );
    }

    if (tx.chainId !== ARC_TESTNET_CHAIN_ID) {
        throw new ArcVerificationError(
            'WRONG_CHAIN',
            'Transaction was not submitted on Arc Testnet.',
        );
    }

    if (receipt.status !== 1) {
        throw new ArcVerificationError(
            'TX_FAILED',
            'Transaction failed on Arc Testnet.',
        );
    }

    return { tx, receipt };
}

export function buildReservation(agentId: string, walletAddress: string, verificationCode: string, tweetId: string): ClaimReservation {
    const authorizedWallet = getAddress(walletAddress);
    const reservationHash = solidityPackedKeccak256(
        ['string', 'address', 'string', 'string'],
        [agentId, authorizedWallet, verificationCode, tweetId],
    );
    const expiryTimestamp = BigInt(Math.floor(Date.now() / 1000) + 60 * 60);

    return {
        reservationHash,
        expiryTimestamp,
        authorizedWallet,
    };
}

// AgentRegistry keeps isVerified/isFullyVerified as separate admin-gated
// mappings that mintReservedAgent never touches — minting alone leaves both
// false. Every frontend badge is documented as "claimed + minted on-chain",
// i.e. it expects minting to be what fully verifies the agent, so the claim
// flow calls this right after a successful mint. Best-effort: if the admin
// signer isn't configured or the tx fails, the agent stays correctly claimed
// but unverified rather than blocking the claim finalize.
async function markVerifiedOnChain(tokenId: bigint): Promise<{ isVerified: boolean; isFullyVerified: boolean } | null> {
    try {
        const registry = new Contract(
            ensureAddress(AGENT_REGISTRY_ADDRESS, 'AGENT_REGISTRY_ADDRESS'),
            agentRegistryAbi,
            getAdminSigner(),
        );

        const tx = await registry.setVerificationStatus(tokenId, true, true);
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) {
            return null;
        }

        return { isVerified: true, isFullyVerified: true };
    } catch (error) {
        console.error(`[arc] failed to mark tokenId ${tokenId} verified on-chain —`, error instanceof Error ? error.message : error);
        return null;
    }
}

export async function reserveAgentWithAdmin(agentId: string, reservation: ClaimReservation) {
    const registry = new Contract(
        ensureAddress(AGENT_REGISTRY_ADDRESS, 'AGENT_REGISTRY_ADDRESS'),
        agentRegistryAbi,
        getAdminSigner(),
    );

    const tx = await registry.reserveAgent(
        agentId,
        reservation.reservationHash,
        reservation.expiryTimestamp,
        reservation.authorizedWallet,
    );
    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
        throw new ArcVerificationError('RESERVATION_FAILED', 'Arc reservation transaction failed.');
    }

    return {
        txHash: tx.hash,
    };
}

export async function getOnchainAgentState(agentId: string): Promise<OnchainAgentState> {
    const registry = getAgentRegistry();
    const agentKey = keccak256(toUtf8Bytes(agentId));
    const tokenId = await registry.agentKeyToTokenId(agentKey) as bigint;

    if (tokenId === 0n) {
        return {
            minted: false,
            tokenId,
            owner: null,
            payoutWallet: null,
            isVerified: false,
            isFullyVerified: false,
        };
    }

    const [owner, payoutWallet, isVerified, isFullyVerified] = await Promise.all([
        registry.ownerOf(tokenId) as Promise<string>,
        registry.payoutWallets(tokenId) as Promise<string>,
        registry.isVerified(tokenId) as Promise<boolean>,
        registry.isFullyVerified(tokenId) as Promise<boolean>,
    ]);

    return {
        minted: true,
        tokenId,
        owner: getAddress(owner),
        payoutWallet: isAddress(payoutWallet) ? getAddress(payoutWallet) : null,
        isVerified,
        isFullyVerified,
    };
}

export async function verifyMintTransaction(params: {
    txHash: string;
    expectedAgentId: string;
    expectedOwner?: string | null;
}): Promise<VerifiedMintTransaction> {
    const { tx, receipt } = await getVerifiedTransaction(params.txHash);
    const registryAddress = ensureAddress(AGENT_REGISTRY_ADDRESS, 'AGENT_REGISTRY_ADDRESS');

    if (!tx.to || getAddress(tx.to) !== registryAddress) {
        throw new ArcVerificationError('WRONG_CONTRACT', 'Transaction was not sent to AgentRegistry.');
    }

    const parsedTx = agentRegistryInterface.parseTransaction({ data: tx.data, value: tx.value });
    if (!parsedTx || parsedTx.name !== 'mintReservedAgent') {
        throw new ArcVerificationError('WRONG_METHOD', 'Transaction is not an agent mint transaction.');
    }

    const agentId = String(parsedTx.args[0]);
    const metadataUri = String(parsedTx.args[1]);
    const payoutWallet = getAddress(String(parsedTx.args[2]));
    const owner = getAddress(tx.from);

    if (agentId !== params.expectedAgentId) {
        throw new ArcVerificationError('AGENT_MINT_MISMATCH', 'Mint transaction was submitted for a different agent.');
    }

    if (params.expectedOwner && getAddress(params.expectedOwner) !== owner) {
        throw new ArcVerificationError('MINT_OWNER_MISMATCH', 'Mint transaction sender does not match the connected wallet.');
    }

    const onchainState = await getOnchainAgentState(agentId);
    if (!onchainState.minted || onchainState.owner !== owner) {
        throw new ArcVerificationError('MINT_NOT_FINALIZED', 'AgentRegistry does not show the expected minted owner yet.');
    }

    const block = await provider.getBlock(receipt.blockNumber);
    const verification = await markVerifiedOnChain(onchainState.tokenId);

    return {
        txHash: receipt.hash,
        agentId,
        owner,
        payoutWallet,
        metadataUri,
        tokenId: onchainState.tokenId,
        isVerified: verification?.isVerified ?? onchainState.isVerified,
        isFullyVerified: verification?.isFullyVerified ?? onchainState.isFullyVerified,
        mintedAt: new Date(Number(block!.timestamp) * 1000).toISOString(),
    };
}

export function isEvmAddress(value: string | undefined | null) {
    return !!value && isAddress(value);
}

export function normalizeAddress(value: string) {
    return getAddress(value);
}

// Native USDC balance on Arc (18 decimals at the protocol level — USDC is
// the chain's gas token, not a separate ERC20 balance).
export async function getNativeUsdcBalance(address: string): Promise<string> {
    const balance = await provider.getBalance(getAddress(address));
    return formatEther(balance);
}
