// Privy (email login, embedded wallet) — replaces Circle User-Controlled
// Wallets for human authentication, which proved unreliable in real use
// (login loops, permanent hangs on return-device logins, mobile breakage).
// Modeled on Circuits Protocol's own working migration (~/clawd-hq/apps/web/
// src/app/api/social/auth/privy-verify/route.ts) — same Privy App ID, so a
// human's wallet matches across both platforms.
import { PrivyClient, isEmbeddedWalletLinkedAccount, type LinkedAccount, type User } from '@privy-io/node';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID || '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || '';

export class PrivyAuthError extends Error {
    status: number;

    constructor(message: string, status = 401) {
        super(message);
        this.status = status;
    }
}

let cachedClient: PrivyClient | null = null;

function getClient(): PrivyClient {
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
        throw new PrivyAuthError('Privy is not configured on the server (NEXT_PUBLIC_PRIVY_APP_ID / PRIVY_APP_SECRET).', 503);
    }

    if (!cachedClient) {
        cachedClient = new PrivyClient({ appId: PRIVY_APP_ID, appSecret: PRIVY_APP_SECRET });
    }

    return cachedClient;
}

/** Verifies the identity token's signature against Privy's own JWKS — this
 * verification *is* the proof of wallet ownership, the same role a wallet
 * signature plays elsewhere in this codebase. Never trust a client-claimed
 * wallet address; only ever use what Privy itself reports for the verified
 * user below. */
export async function verifyPrivyIdentityToken(identityToken: string): Promise<User> {
    const client = getClient();

    try {
        return await client.utils().auth().verifyIdentityToken(identityToken);
    } catch {
        throw new PrivyAuthError('Invalid or expired Privy identity token.');
    }
}

/** Prefers the embedded (Privy-custodied) Ethereum wallet over any
 * externally-linked wallet — this is the wallet ClawdHQ's own
 * embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } }
 * config actually creates, and the same one the client resolves via
 * user?.wallet?.address. */
export function walletAddressFromLinkedAccounts(linkedAccounts: LinkedAccount[]): string | undefined {
    const embeddedEthereumWallet = linkedAccounts.find(
        (account): account is Extract<LinkedAccount, { chain_type: 'ethereum' }> =>
            isEmbeddedWalletLinkedAccount(account) && (account as { chain_type?: string }).chain_type === 'ethereum',
    );
    if (embeddedEthereumWallet) {
        return embeddedEthereumWallet.address;
    }

    // Fallback: any linked Ethereum wallet at all (e.g. an externally-linked
    // one), in case embedded wallet creation didn't run for some reason.
    const anyEthereumWallet = linkedAccounts.find(
        (account): account is Extract<LinkedAccount, { type: 'wallet'; chain_type: 'ethereum' }> =>
            account.type === 'wallet' && (account as { chain_type?: string }).chain_type === 'ethereum',
    );
    return anyEthereumWallet?.address;
}

export function emailFromLinkedAccounts(linkedAccounts: LinkedAccount[]): string | undefined {
    const emailAccount = linkedAccounts.find(
        (account): account is Extract<LinkedAccount, { type: 'email' }> => account.type === 'email',
    );
    return emailAccount?.address;
}

export function twitterFromLinkedAccounts(linkedAccounts: LinkedAccount[]): {
    username?: string;
    name?: string;
    profilePictureUrl?: string;
} | undefined {
    const twitterAccount = linkedAccounts.find(
        (account): account is Extract<LinkedAccount, { type: 'twitter_oauth' }> => account.type === 'twitter_oauth',
    );
    if (!twitterAccount) return undefined;
    return {
        username: twitterAccount.username || undefined,
        name: twitterAccount.name || undefined,
        profilePictureUrl: twitterAccount.profile_picture_url || undefined,
    };
}

export function googleFromLinkedAccounts(linkedAccounts: LinkedAccount[]): {
    name?: string;
    email?: string;
} | undefined {
    const googleAccount = linkedAccounts.find(
        (account): account is Extract<LinkedAccount, { type: 'google_oauth' }> => account.type === 'google_oauth',
    );
    if (!googleAccount) return undefined;
    return {
        name: googleAccount.name || undefined,
        email: googleAccount.email || undefined,
    };
}

export function githubFromLinkedAccounts(linkedAccounts: LinkedAccount[]): {
    username?: string;
    name?: string;
} | undefined {
    const githubAccount = linkedAccounts.find(
        (account): account is Extract<LinkedAccount, { type: 'github_oauth' }> => account.type === 'github_oauth',
    );
    if (!githubAccount) return undefined;
    return {
        username: githubAccount.username || undefined,
        name: githubAccount.name || undefined,
    };
}
