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
    polygon: {
      url: process.env.POLYGON_URL,
      accounts: [process.env.PRIVATE_KEY as string],
    },
    hardhat: {
      // chainId: 42161,
      // forking: {
      //   url: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`, //"https://arbitrum.llamarpc.com", //, // "https://arb1.arbitrum.io/rpc",
      //   // blockNumber: 211889162,
      // },

      // chainId: 8453,
      // forking: {
      //   url: `https://base-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`, //"https://base.llamarpc.com",
      //   blockNumber: 20059845,
      // },

      // chainId: 1116,
      // forking: {
      //   url: "https://1rpc.io/core",
      // blockNumber: 18385941,
      // },
      chainId: 137,
      forking: {
        url: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
        // blockNumber: 63664681,
      },
    },

    polygon: {
      chainId: 137,
      url: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY ?? ""],
    },

    arbitrum: {
      chainId: 42161,
      url: "https://arb1.arbitrum.io/rpc",
      accounts: [process.env.PRIVATE_KEY ?? ""],
    },

    core: {
      chainId: 1116,
      url: "https://1rpc.io/core",
      accounts: [process.env.PRIVATE_KEY ?? ""],
    },

    base: {
      chainId: 8453,
      url: "https://base.llamarpc.com",
      accounts: [process.env.PRIVATE_KEY ?? ""],
    },
    mainnet: {
      chainId: 42161,
      url: "https://arb1.arbitrum.io/rpc",
      accounts: [process.env.PRIVATE_KEY ?? ""],
    },
    testnet: {
      chainId: 421611,
      url: "https://rinkeby.arbitrum.io/rpc",
      accounts: [process.env.PRIVATE_KEY ?? ""],
    },
  },
  mocha: {
    timeout: 1000000,
  },
  etherscan: {
    apiKey: {
      base: process.env.BASE_API_KEY ?? "",
      arbitrum: process.env.ETHERSCAN_API_KEY ?? "",
      core: process.env.CORE_API_KEY ?? "",
      polygon: process.env.POLYGON_API_KEY ?? "",
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org/",
        },
      },
      {
        network: "arbitrum",
        chainId: 42161,
        urls: {
          apiURL: "https://api.arbiscan.io/api",
          browserURL: "https://arbiscan.io/",
        },
      },

      {
        network: "core",
        chainId: 1116,
        urls: {
          apiURL: "https://openapi.coredao.org/api",
          browserURL: "https://scan.coredao.org/",
        },
      },
      {
        network: "polygon",
        chainId: 137,
        urls: {
          apiURL: "https://api.polygonscan.com/api",
          browserURL: "https://polygonscan.com/",
        },
      },
    ],
  },
};

export default config;
