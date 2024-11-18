import { Address } from "viem";
import { doVaultFactoryTests } from "./vaultFactory.test";
import { ContractTypesMap } from "hardhat/types";
import { doControllerTests } from "./controller.test";
import { WalletClient } from "@nomicfoundation/hardhat-viem/types";
import { doStrategyTests } from "./strategy.test";
import { doVaultTests } from "./vault.test";
import { doZapperTests } from "./zapper.test";
import { VaultAsset } from "../utils/types";
import { doSwapRouterTests } from "./swapRouter.test";

export type DeployFixture = (doSetup?: boolean) => Promise<{
  stakable: boolean;
  governance: WalletClient;
  strategist: WalletClient;
  timelock: WalletClient;
  devfund: WalletClient;
  treasury: WalletClient;
  user: WalletClient;
  vaultFactory: ContractTypesMap["VaultFactoryBase"];
  vaultAsset: ContractTypesMap["ERC20"];
  usdc: ContractTypesMap["ERC20"];
  wrappedNative: ContractTypesMap["IWETH"];
  zapper: ContractTypesMap["ZapperBase"];
  swapRouter: ContractTypesMap["ISwapRouter"];
  vault: ContractTypesMap["Vault"];
  strategy: ContractTypesMap["StrategyBase"];
  controller: ContractTypesMap["Controller"];
  strategyBytecode: Address;
  strategyExtraParams: Address;
  maxSlippage: bigint;
  usdcDecimals: number;
}>;

export const doProtocolTest = async (params: {
  protocolName: string;
  vaultAssets: VaultAsset[];
  getDeployFixture: (asset: VaultAsset) => DeployFixture;
  doProtocolSpecificTest: (asset: VaultAsset) => void;
}) => {
  for (let i = 0; i < params.vaultAssets.length; i++) {
    const deployFixure = params.getDeployFixture(params.vaultAssets[i]);

    describe(`${params.protocolName} ${params.vaultAssets[i].name} Test`, function () {
      params.doProtocolSpecificTest(params.vaultAssets[i]);

      doVaultFactoryTests(deployFixure);

      doVaultTests(deployFixure);

      doControllerTests(deployFixure);

      doStrategyTests(deployFixure);

      doSwapRouterTests(deployFixure);

      doZapperTests(deployFixure);
    });
  }
};
