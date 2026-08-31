// Circle Agent Wallets (developer-controlled) on Arc Testnet.
//
// Every registered agent gets a Circle MPC wallet (EOA on ARC-TESTNET) created
// through the developer-controlled wallets SDK. The platform treasury is a
// wallet in the same wallet set; it receives Gateway nanopayment settlements
// (as the x402 seller address) and pays out agent tip shares.
//
// Agents may instead bring an externally managed wallet (e.g. created with the
// Circle CLI Agent Wallets flow) via POST /agents/wallet — see routes/agents.ts.
import {
    initiateDeveloperControlledWalletsClient,
    type CircleDeveloperControlledWalletsClient,
} from '@circle-fin/developer-controlled-wallets';

const ARC_BLOCKCHAIN = 'ARC-TESTNET' as const;
// On Arc, USDC is the native token; Circle's transactions API expects an empty
// tokenAddress for native-token transfers.
const NATIVE_USDC_TOKEN_ADDRESS = '';

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY || '';
const CIRCLE_ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET || '';

let cachedClient: CircleDeveloperControlledWalletsClient | null = null;
let cachedWalletSetId: string | null = process.env.CIRCLE_WALLET_SET_ID || null;
let cachedTreasury: { walletId: string; address: string } | null =
    process.env.CIRCLE_TREASURY_WALLET_ID && process.env.CIRCLE_TREASURY_WALLET_ADDRESS
        ? {
            walletId: process.env.CIRCLE_TREASURY_WALLET_ID,
            address: process.env.CIRCLE_TREASURY_WALLET_ADDRESS,
        }
        : null;

export class CircleWalletError extends Error {
    code: string;
    status: number;

    constructor(code: string, message: string, status = 502) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

export function isCircleWalletsConfigured() {
    return !!(CIRCLE_API_KEY && CIRCLE_ENTITY_SECRET);
}

function getClient(): CircleDeveloperControlledWalletsClient {
    if (!isCircleWalletsConfigured()) {
        throw new CircleWalletError(
            'CIRCLE_NOT_CONFIGURED',
            'CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET are required for Circle Agent Wallets.',
            503,
        );
    }

    if (!cachedClient) {
        cachedClient = initiateDeveloperControlledWalletsClient({
            apiKey: CIRCLE_API_KEY,
            entitySecret: CIRCLE_ENTITY_SECRET,
        });
    }

    return cachedClient;
}

async function ensureWalletSetId(): Promise<string> {
    if (cachedWalletSetId) {
        return cachedWalletSetId;
    }

    const client = getClient();
    const response = await client.createWalletSet({ name: 'clawdhq-agents' });
    const walletSetId = response.data?.walletSet?.id;
    if (!walletSetId) {
        throw new CircleWalletError('WALLET_SET_FAILED', 'Circle wallet set creation returned no id.');
    }

    cachedWalletSetId = walletSetId;
    console.log(
        `[circle] Created wallet set ${walletSetId}. Set CIRCLE_WALLET_SET_ID=${walletSetId} to pin it across restarts.`,
    );
    return walletSetId;
}

export interface AgentWallet {
    walletId: string;
    address: string;
}

async function createWalletInSet(refId: string, name: string): Promise<AgentWallet> {
    const client = getClient();
    const walletSetId = await ensureWalletSetId();

    // Gateway nanopayments require EOA signers, so agent wallets are EOAs.
    const response = await client.createWallets({
        walletSetId,
        blockchains: [ARC_BLOCKCHAIN],
        count: 1,
        accountType: 'EOA',
        metadata: [{ name, refId }],
    });

    const wallet = response.data?.wallets?.[0];
    if (!wallet?.id || !wallet.address) {
        throw new CircleWalletError('WALLET_CREATE_FAILED', 'Circle wallet creation returned no wallet.');
    }

    return { walletId: wallet.id, address: wallet.address };
}

export async function createAgentWallet(agentId: string, handle: string): Promise<AgentWallet> {
    return createWalletInSet(agentId, `agent:${handle}`);
}

export async function ensureTreasuryWallet(): Promise<AgentWallet> {
    if (cachedTreasury) {
        return cachedTreasury;
    }

    const treasury = await createWalletInSet('platform-treasury', 'clawdhq-treasury');
    cachedTreasury = treasury;
    console.log(
        `[circle] Created treasury wallet ${treasury.walletId} (${treasury.address}). ` +
        `Set CIRCLE_TREASURY_WALLET_ID and CIRCLE_TREASURY_WALLET_ADDRESS to pin it.`,
    );
    return treasury;
}

export function getTreasuryAddress(): string | null {
    return cachedTreasury?.address || process.env.GATEWAY_SELLER_ADDRESS || process.env.PLATFORM_WALLET || null;
}

// Transfers native USDC on Arc Testnet from any Circle-custodied wallet this
// platform controls (treasury or an agent's own developer-controlled wallet).
export async function transferUsdc(sourceWalletId: string, destinationAddress: string, amountUsdc: string) {
    const client = getClient();

    const response = await client.createTransaction({
        walletId: sourceWalletId,
        tokenAddress: NATIVE_USDC_TOKEN_ADDRESS,
        blockchain: ARC_BLOCKCHAIN,
        amount: [amountUsdc],
        destinationAddress,
        fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    } as any);

    const transaction = response.data as { id?: string; state?: string } | undefined;
    if (!transaction?.id) {
        throw new CircleWalletError('TRANSFER_FAILED', 'Circle transfer returned no transaction id.');
    }

    return { transactionId: transaction.id, state: transaction.state ?? 'INITIATED' };
}

// Transfers native USDC on Arc Testnet from the treasury wallet.
export async function transferUsdcFromTreasury(destinationAddress: string, amountUsdc: string) {
    const treasury = await ensureTreasuryWallet();
    return transferUsdc(treasury.walletId, destinationAddress, amountUsdc);
}
