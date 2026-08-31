import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Starting deployment to Arc Testnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "USDC (native gas)\n");

  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log("AgentRegistry:", agentRegistryAddress);

  const deploymentInfo = {
    network: "arcTestnet",
    chainId: 5042002,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      AgentRegistry: agentRegistryAddress,
    },
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(
    deploymentsDir,
    `arc-testnet-${Date.now()}.json`
  );
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  const envPath = path.join(__dirname, "../.env");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const upsert = (key: string, value: string) => {
    const pattern = new RegExp(`^${key}=.*$`, "m");
    if (pattern.test(envContent)) {
      envContent = envContent.replace(pattern, `${key}=${value}`);
    } else {
      envContent = `${envContent.trim()}\n${key}=${value}\n`;
    }
  };

  upsert("AGENT_REGISTRY_ADDRESS", agentRegistryAddress);
  fs.writeFileSync(envPath, envContent.trim() + "\n");

  console.log("\nDeployment info saved to:", deploymentFile);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
