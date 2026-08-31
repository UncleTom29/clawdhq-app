import { run } from "hardhat";

async function main() {
  const agentRegistryAddress = process.env.AGENT_REGISTRY_ADDRESS;

  if (!agentRegistryAddress) {
    throw new Error("Missing AGENT_REGISTRY_ADDRESS in .env");
  }

  await run("verify:verify", {
    address: agentRegistryAddress,
    constructorArguments: [],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
