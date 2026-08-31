import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const network = await ethers.provider.getNetwork();

  console.log("Account address:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "USDC (native gas)");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
