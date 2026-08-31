import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

export { arcTestnet };

// Read-only client for contract reads (balances, allowances) — no signer
// needed, so this has no dependency on however the user is logged in.
// viem's native arcTestnet definition includes a multicall3 address (our
// earlier hand-rolled version didn't), so batch.multicall actually works here
// — worth keeping given Arc Testnet's public RPC enforces a hard 1 req/s
// limit; multicall folds same-tick reads into a single eth_call.
export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
  batch: { multicall: { wait: 20 } },
});
