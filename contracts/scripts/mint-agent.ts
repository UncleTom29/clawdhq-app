import { ethers } from "hardhat";

async function main() {
  const [agentId, metadataUri, payoutWallet] = process.argv.slice(2);

  if (!agentId || !metadataUri || !payoutWallet) {
    throw new Error(
      "Usage: hardhat run scripts/mint-agent.ts --network arcTestnet -- <agentId> <metadataUri> <payoutWallet>"
    );
  }

  const registryAddress = process.env.AGENT_REGISTRY_ADDRESS;
  if (!registryAddress) {
    throw new Error("AGENT_REGISTRY_ADDRESS is not set.");
  }

  const [signer] = await ethers.getSigners();
  const registry = await ethers.getContractAt("AgentRegistry", registryAddress, signer);

  console.log("Minting reserved agent...");
  console.log("Signer:", signer.address);
  console.log("Agent ID:", agentId);
  console.log("Metadata URI:", metadataUri);
  console.log("Payout wallet:", payoutWallet);

  const tx = await registry.mintReservedAgent(agentId, metadataUri, payoutWallet);
  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Mint transaction failed.");
  }

  console.log("Mint transaction hash:", tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
