import hre from "hardhat";
import { Address, getAddress, parseEther } from "viem";
import { bytecode as GammaStrategyBytecode } from "../artifacts/contracts/strategies/GammaStrategy.sol/GammaStrategy.json";
import {
  DeployVaultFactoryFixture,
  doVaultFactoryTests,
} from "./vaultFactory.test";
import { ContractTypesMap } from "hardhat/types";
import { doControllerTests } from "./controller.test";
import { WalletClient } from "@nomicfoundation/hardhat-viem/types";
import { doStrategyTests } from "./strategy.test";
import { doVaultTests } from "./vault.test";

export type DeployVaultWithoutFactoryFixture = (doSetup?: boolean) => Promise<{
  stakable: boolean;
  governance: WalletClient;
  strategist: WalletClient;
  timelock: WalletClient;
  devfund: WalletClient;
  treasury: WalletClient;
  user: WalletClient;
  vaultAsset: ContractTypesMap["MockERC20"];
  vault: ContractTypesMap["Vault"];
  strategy: ContractTypesMap["StrategyBase"];
  controller: ContractTypesMap["Controller"];
}>;

describe("Gamma Vault Test", function () {
  const deployVaultFactory: DeployVaultFactoryFixture = async () => {
    const vaultAsset = getAddress("0x02203f2351E7aC6aB5051205172D3f772db7D814"); // WpolWeth
    const [governance, strategist, timelock, devfund, treasury, user] =
      await hre.viem.getWalletClients();

    // Deploy the GammaVaultFactory
    const VaultFactory = (await hre.viem.deployContract("GammaVaultFactory", [
      governance.account.address,
    ])) as unknown as ContractTypesMap["IVaultFactory"];

    return {
      governance,
      strategist,
      timelock,
      devfund,
      treasury,
      user,
      vaultAsset,
      VaultFactory,
      strategyBytecode: GammaStrategyBytecode as Address,
      strategyExtraParams: "0x",
    };
  };

  const deployVaultWithoutFactory: DeployVaultWithoutFactoryFixture = async (
    doSetup: boolean = true
  ) => {
    const [governance, strategist, timelock, devfund, treasury, user] =
      await hre.viem.getWalletClients();

    // Deploy Mock vault asset
    const vaultAsset = await hre.viem.deployContract("MockERC20", [
      "Mock Token",
      "MTK",
    ]);

    // Deploy Controller first
    const controller = await hre.viem.deployContract("Controller", [
      governance.account.address,
      strategist.account.address,
      timelock.account.address,
      devfund.account.address,
      treasury.account.address,
    ]);

    // Deploy Strategy
    const strategy = (await hre.viem.deployContract("GammaStrategy", [
      vaultAsset.address,
      governance.account.address,
      strategist.account.address,
      controller.address,
      timelock.account.address,
    ])) as unknown as ContractTypesMap["StrategyBase"];

    // Deploy Vault
    const vault = await hre.viem.deployContract("Vault", [
      vaultAsset.address,
      governance.account.address,
      timelock.account.address,
      controller.address,
    ]);

    // Mint some tokens to the user
    await vaultAsset.write.mint([user.account.address, parseEther("1000000")]);

    if (doSetup) {
      // Set up controller relationships
      await controller.write.setVault([vaultAsset.address, vault.address], {
        account: governance.account,
      });
      await controller.write.approveStrategy(
        [vaultAsset.address, strategy.address],
        {
          account: timelock.account,
        }
      );
      await controller.write.setStrategy(
        [vaultAsset.address, strategy.address],
        {
          account: governance.account,
        }
      );
    }
    return {
      stakable: false,
      governance,
      strategist,
      timelock,
      devfund,
      treasury,
      user,
      vaultAsset,
      vault,
      strategy,
      controller,
    };
  };

  // need forking to test gamma strategies
  doVaultFactoryTests(deployVaultFactory);

  doControllerTests(deployVaultWithoutFactory);

  doStrategyTests(deployVaultWithoutFactory);

  doVaultTests(deployVaultWithoutFactory);

  // TODO: add tests for vault, test both stakable and non-stakable strategies
});
