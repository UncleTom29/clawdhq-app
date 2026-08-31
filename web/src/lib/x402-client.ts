// ---------------------------------------------------------------------------
// Browser x402 buyer for Circle Gateway nanopayments (Arc Testnet).
//
// Flow: request the paid endpoint → receive 402 with a base64 PAYMENT-REQUIRED
// header → sign a gasless EIP-3009 TransferWithAuthorization (EIP-712, domain
// "GatewayWalletBatched" against the GatewayWallet contract) with the
// connected wallet → retry with the Payment-Signature header. Circle Gateway
// verifies/settles server-side and batches settlements onchain.
//
// The payer must have USDC deposited in the GatewayWallet contract on Arc
// Testnet (see useGatewayDeposit in hooks/useSmartContract.ts).
// ---------------------------------------------------------------------------

import { ARC_CAIP2_NETWORK } from '@/contracts/addresses';

const CIRCLE_BATCHING_NAME = 'GatewayWalletBatched';
const CIRCLE_BATCHING_VERSION = '1';
// Gateway requires authorizations valid for >= 7 days (+ buffer).
const AUTH_VALIDITY_WINDOW_SECONDS = 7 * 24 * 60 * 60 + 100;

export interface GatewayPaymentRequirements {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: {
    name?: string;
    version?: string;
    verifyingContract?: string;
    [key: string]: unknown;
  };
}

interface PaymentRequired {
  x402Version: number;
  resource?: { url: string; description: string; mimeType: string };
  accepts: GatewayPaymentRequirements[];
}

export interface X402SignTypedData {
  (params: {
    domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}` };
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`>;
}

export interface X402PayResult {
  response: Response;
  paidAmountMicro: bigint;
  settlement: { success: boolean; transaction?: string; network?: string; payer?: string } | null;
}

export class X402Error extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function decodeBase64Json<T>(value: string): T {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function encodeJsonBase64(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function createNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}` as `0x${string}`;
}

const AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

/**
 * Pay for an x402-protected ClawdHQ endpoint with the connected wallet.
 * Sends the request, and if it comes back 402, signs the Gateway payment
 * authorization and retries. Non-402 responses pass straight through.
 */
export async function payWithX402(params: {
  url: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  account: `0x${string}`;
  signTypedData: X402SignTypedData;
  network?: string;
}): Promise<X402PayResult> {
  const method = params.method ?? 'POST';
  const network = params.network ?? ARC_CAIP2_NETWORK;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...params.headers,
  };
  const serializedBody = params.body !== undefined ? JSON.stringify(params.body) : undefined;

  const initialResponse = await fetch(params.url, { method, headers, body: serializedBody });
  if (initialResponse.status !== 402) {
    return { response: initialResponse, paidAmountMicro: BigInt(0), settlement: null };
  }

  const paymentRequiredHeader = initialResponse.headers.get('PAYMENT-REQUIRED');
  if (!paymentRequiredHeader) {
    throw new X402Error('MISSING_REQUIREMENTS', 'Missing PAYMENT-REQUIRED header in 402 response');
  }

  const paymentRequired = decodeBase64Json<PaymentRequired>(paymentRequiredHeader);
  const option = paymentRequired.accepts?.find(
    (candidate) =>
      candidate.network === network &&
      candidate.extra?.name === CIRCLE_BATCHING_NAME &&
      candidate.extra?.version === CIRCLE_BATCHING_VERSION &&
      typeof candidate.extra?.verifyingContract === 'string',
  );
  if (!option) {
    throw new X402Error(
      'NETWORK_NOT_SUPPORTED',
      `No Gateway payment option for ${network}. Available: ${paymentRequired.accepts
        ?.map((candidate) => candidate.network)
        .join(', ')}`,
    );
  }

  const chainId = Number(option.network.split(':')[1]);
  const now = Math.floor(Date.now() / 1000);
  const validityWindow = Math.max(option.maxTimeoutSeconds || 0, AUTH_VALIDITY_WINDOW_SECONDS);
  const authorization = {
    from: params.account,
    to: option.payTo as `0x${string}`,
    value: option.amount,
    validAfter: (now - 600).toString(),
    validBefore: (now + validityWindow).toString(),
    nonce: createNonce(),
  };

  const signature = await params.signTypedData({
    domain: {
      name: CIRCLE_BATCHING_NAME,
      version: CIRCLE_BATCHING_VERSION,
      chainId,
      verifyingContract: option.extra!.verifyingContract as `0x${string}`,
    },
    types: AUTHORIZATION_TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from: authorization.from,
      to: authorization.to,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  });

  const paymentHeader = encodeJsonBase64({
    x402Version: paymentRequired.x402Version ?? 2,
    payload: { signature, authorization },
    resource: paymentRequired.resource,
    accepted: option,
  });

  const paidResponse = await fetch(params.url, {
    method,
    headers: { ...headers, 'Payment-Signature': paymentHeader },
    body: serializedBody,
  });

  let settlement: X402PayResult['settlement'] = null;
  const paymentResponseHeader = paidResponse.headers.get('PAYMENT-RESPONSE');
  if (paymentResponseHeader) {
    try {
      settlement = decodeBase64Json(paymentResponseHeader);
    } catch {
      settlement = null;
    }
  }

  if (!paidResponse.ok) {
    const errorBody = await paidResponse
      .clone()
      .json()
      .catch(() => ({} as Record<string, unknown>));
    throw new X402Error(
      'PAYMENT_FAILED',
      String((errorBody as any)?.error?.message || (errorBody as any)?.error || paidResponse.statusText),
    );
  }

  return { response: paidResponse, paidAmountMicro: BigInt(option.amount), settlement };
}

/** Resolve the API origin (strip the /api/v1 suffix from NEXT_PUBLIC_API_URL). */
export function apiOrigin(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1';
  return base.replace(/\/api\/v1\/?$/, '');
}

/** Full URL for an /api/v1 path on the ClawdHQ API. */
export function apiV1Url(path: string): string {
  return `${apiOrigin()}/api/v1${path.startsWith('/') ? path : `/${path}`}`;
}
