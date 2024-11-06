import hre from "hardhat";
import { Address } from "viem";
import { doVaultFactoryTests } from "./vaultFactory.test";
import { ContractTypesMap } from "hardhat/types";
import { doControllerTests } from "./controller.test";
import { WalletClient } from "@nomicfoundation/hardhat-viem/types";
import { doStrategyTests } from "./strategy.test";
import { doVaultTests } from "./vault.test";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

export type DeployFixture = (doSetup?: boolean) => Promise<{
  stakable: boolean;
  governance: WalletClient;
  strategist: WalletClient;
  timelock: WalletClient;
  devfund: WalletClient;
  treasury: WalletClient;
  user: WalletClient;
  VaultFactory: ContractTypesMap["VaultFactoryBase"];
  vaultAsset: ContractTypesMap["ERC20"];
  vault: ContractTypesMap["Vault"];
  strategy: ContractTypesMap["StrategyBase"];
  controller: ContractTypesMap["Controller"];
  strategyBytecode: Address;
  strategyExtraParams: Address;
}>;

export const doProtocolTest = async (params: {
  protocolName: string;
  vaultAssets: Address[];
  getDeployFixture: (asset: Address) => DeployFixture;
}) => {
  for (let i = 0; i < params.vaultAssets.length; i++) {
    const deployFixure = params.getDeployFixture(params.vaultAssets[i]);
    // const { vaultAsset } = await loadFixture(deployFixure);
    // const vaultSssetContract = await hre.viem.getContractAt("IERC20Metadata", vaultAsset.address);
    const vaultAssetName = "hi"; // await vaultSssetContract.read.name();

    describe(`${params.protocolName} ${vaultAssetName} Vault Test`, function () {
      doVaultFactoryTests(deployFixure);

      doControllerTests(deployFixure);

      doStrategyTests(deployFixure);

      doVaultTests(deployFixure);

      // TODO: add tests for vault, test both stakable and non-stakable strategies
    });
  }
};
