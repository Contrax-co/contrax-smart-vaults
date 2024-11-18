import { Address } from "viem";
import { doVaultFactoryTests } from "./vaultFactory.test";
import { ContractTypesMap } from "hardhat/types";
import { doControllerTests } from "./controller.test";
import { WalletClient } from "@nomicfoundation/hardhat-viem/types";
import { doStrategyTests } from "./strategy.test";
import { doVaultTests } from "./vault.test";
import { doZapperTests } from "./zapper.test";

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
  vaultAssets: Address[];
  getDeployFixture: (asset: Address) => DeployFixture;
}) => {
  for (let i = 0; i < params.vaultAssets.length; i++) {
    const deployFixure = params.getDeployFixture(params.vaultAssets[i]);
    // const { vaultAsset } = await loadFixture(deployFixure);
    // const vaultAssetContract = await hre.viem.getContractAt("IERC20Metadata", vaultAsset.address);
    // const vaultAssetName = await vaultAssetContract.read.name();

    // TODO: get vaultAssetName from contract
    const vaultAssetName = "{some} token";

    describe(`${params.protocolName} ${vaultAssetName} Vault Test`, function () {
      doVaultFactoryTests(deployFixure);

      doVaultTests(deployFixure);

      doControllerTests(deployFixure);

      doStrategyTests(deployFixure);

      doZapperTests(deployFixure);
    });
  }
};
