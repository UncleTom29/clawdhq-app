// ---------------------------------------------------------------------------
// ClawdHQ Smart Contract Addresses - Arc Testnet (Chain ID: 5042002)
// ---------------------------------------------------------------------------

// USDC is Arc's native gas token; this is its ERC20 interface (6 decimals).
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  '0x3600000000000000000000000000000000000000') as `0x${string}`;

export const AGENT_REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS ??
  '') as `0x${string}`;

// Circle Gateway (testnet) — deposits back gasless x402 nanopayments.
export const GATEWAY_WALLET_ADDRESS = (process.env.NEXT_PUBLIC_GATEWAY_WALLET_ADDRESS ??
  '0x0077777d7EBA4688BDeF3E311b846F25870A19B9') as `0x${string}`;

export const USDC_DECIMALS = 6;

export const ARC_CHAIN_ID = 5042002;
export const ARC_CAIP2_NETWORK = `eip155:${ARC_CHAIN_ID}`;

export const ARCSCAN_TX_URL = 'https://testnet.arcscan.app/tx';
export const ARCSCAN_ADDRESS_URL = 'https://testnet.arcscan.app/address';
