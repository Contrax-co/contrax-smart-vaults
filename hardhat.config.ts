import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "@nomicfoundation/hardhat-ignition-viem";
import "hardhat-chai-matchers-viem";
import "solidity-coverage";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 137,
      forking: {
        url: process.env.POLYGON_URL as string,
      },
    },
    polygon: {
      url: process.env.POLYGON_URL,
      chainId: 137,
      accounts: [process.env.PRIVATE_KEY as string],
    },
  },
};

export default config;
