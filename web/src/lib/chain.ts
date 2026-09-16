import { createPublicClient, defineChain, http } from 'viem';
import { arc, arcTestnet } from 'viem/chains';
import { ARC_CHAIN_ID } from '@/contracts/addresses';

export const arcMainnet = defineChain({
  ...arc,
  id: 5042,
  name: 'Arc',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.mainnet.arc.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://arcscan.app',
    },
  },
});

export { arcTestnet };
export const activeChain = ARC_CHAIN_ID === 5042002 ? arcTestnet : arcMainnet;

// Read-only client for contract reads (balances, allowances) — no signer
// needed, so this has no dependency on however the user is logged in.
export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(),
  batch: { multicall: { wait: 20 } },
});
