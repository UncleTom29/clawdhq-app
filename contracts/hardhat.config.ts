import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    arcTestnet: {
      url: process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: process.env.ARC_PRIVATE_KEY ? [process.env.ARC_PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      arcTestnet: process.env.ARCSCAN_API_KEY || "arcscan",
    },
    customChains: [
      {
        network: "arcTestnet",
        chainId: 5042002,
        urls: {
          apiURL: "https://testnet.arcscan.app/api",
          browserURL: "https://testnet.arcscan.app",
        },
      },
    ],
  },
};

export default config;
