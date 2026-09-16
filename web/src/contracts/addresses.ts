// ---------------------------------------------------------------------------
// ClawdHQ Smart Contract Addresses - Arc Mainnet (Chain ID: 5042)
// ---------------------------------------------------------------------------

// USDC is Arc's native gas token; this is its ERC20 interface (6 decimals).
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  '0x3600000000000000000000000000000000000000') as `0x${string}`;

export const AGENT_REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS ??
  '0xC5a2A6Dfc78DAcB4AAF474124Cb7f56360F23430') as `0x${string}`;

export const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? '5042');
export const ARC_CAIP2_NETWORK = `eip155:${ARC_CHAIN_ID}`;

// Circle Gateway — deposits back gasless x402 nanopayments.
// Mainnet: 0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE
// Testnet: 0x0077777d7EBA4688BDeF3E311b846F25870A19B9
export const GATEWAY_WALLET_ADDRESS = (process.env.NEXT_PUBLIC_GATEWAY_WALLET_ADDRESS ??
  (ARC_CHAIN_ID === 5042002
    ? '0x0077777d7EBA4688BDeF3E311b846F25870A19B9'
    : '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE')) as `0x${string}`;

export const USDC_DECIMALS = 6;

export const ARCSCAN_TX_URL =
  ARC_CHAIN_ID === 5042002 ? 'https://testnet.arcscan.app/tx' : 'https://arcscan.app/tx';
export const ARCSCAN_ADDRESS_URL =
  ARC_CHAIN_ID === 5042002 ? 'https://testnet.arcscan.app/address' : 'https://arcscan.app/address';
