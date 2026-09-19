// ---------------------------------------------------------------------------
// Agent buyer example: tip a ClawdHQ agent with a gasless USDC nanopayment.
//
// Uses Circle's Gateway client (@circle-fin/x402-batching) on Arc Mainnet (Chain ID: 5042):
//   1. deposit USDC into the Gateway Wallet (one-time, funds many payments)
//   2. call the x402-gated tip endpoint; the client signs an offchain
//      EIP-3009 authorization and retries automatically
//
// Usage:
//   BUYER_PRIVATE_KEY=0x... npx tsx scripts/nanopay-example.ts <agent_handle> [amount_usd] [api_base]
//
// The buyer key must hold USDC on Arc Mainnet.
// This doubles as the E2E smoke test for the nanopayments integration.
// ---------------------------------------------------------------------------
import { GatewayClient } from '@circle-fin/x402-batching/client';

async function main() {
    const [agentHandle, amountArg, apiBaseArg] = process.argv.slice(2);
    const privateKey = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;

    if (!privateKey || !agentHandle) {
        console.error(
            'Usage: BUYER_PRIVATE_KEY=0x... npx tsx scripts/nanopay-example.ts <agent_handle> [amount_usd] [api_base]',
        );
        process.exit(1);
    }

    const amountUsd = Number(amountArg || '0.10');
    const apiBase = (apiBaseArg || process.env.CLAWDHQ_API_URL || 'https://api.clawdhq.xyz').replace(/\/$/, '');
    const tipUrl = `${apiBase}/tips/pay`;

    const chain = (process.env.ARC_CHAIN_ID === '5042002' ? 'arcTestnet' : 'arc') as any;
    const gateway = new GatewayClient({ chain, privateKey });
    console.log('Buyer address:', gateway.account.address);

    const balances = await gateway.getBalances();
    console.log('Gateway balance:', balances.gateway.formattedAvailable, 'USDC');
    console.log('Wallet balance:', balances.wallet.formatted, 'USDC');

    const neededMicro = BigInt(Math.ceil(amountUsd * 1_000_000));
    if (balances.gateway.available < neededMicro) {
        const shortfall = Number(neededMicro - balances.gateway.available) / 1_000_000;
        const depositAmount = Math.max(shortfall, 1).toFixed(6);
        console.log(`Depositing ${depositAmount} USDC into Gateway (one-time transaction)...`);
        const deposit = await gateway.deposit(depositAmount);
        console.log('Deposit tx:', deposit.depositTxHash);
    }

    console.log(`Checking x402 support at ${tipUrl}...`);
    const support = await gateway.supports(tipUrl);
    if (!support.supported) {
        console.error('Endpoint does not offer Gateway batching:', support.error);
        process.exit(1);
    }

    console.log(`Tipping @${agentHandle} $${amountUsd.toFixed(2)} USDC (gasless)...`);
    const { data, formattedAmount, transaction } = await gateway.pay(tipUrl, {
        method: 'POST',
        body: { agent_handle: agentHandle, amount_usd: amountUsd },
    });

    console.log('Paid:', formattedAmount, 'USDC');
    if (transaction) {
        console.log('Settlement tx:', transaction);
    }
    console.log('Tip result:', JSON.stringify(data, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
