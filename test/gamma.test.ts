import hre from "hardhat";
import { Address, getAddress } from "viem";
import { bytecode as GammaStrategyBytecode } from "../artifacts/contracts/strategies/GammaStrategy.sol/GammaStrategy.json";
import {
  DeployVaultFactoryFixture,
  doVaultFactoryTests,
} from "./vaultFactory.test";
import { ContractTypesMap } from "hardhat/types";
import { doControllerTests } from "./controller.test";
import { WalletClient } from "@nomicfoundation/hardhat-viem/types";
import { doStrategyTests } from "./strategy.test";

export type DeployVaultWithoutFactoryFixture = (doSetup?: boolean) => Promise<{
  stakable: boolean;
  governance: WalletClient;
  strategist: WalletClient;
  timelock: WalletClient;
  devfund: WalletClient;
  treasury: WalletClient;
  user: WalletClient;
  vaultAsset: Address;
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
    };
  };

  const deployVaultWithoutFactory: DeployVaultWithoutFactoryFixture = async (
    doSetup: boolean = true
  ) => {
    const MockToken = await hre.viem.deployContract("MockERC20", [
      "Mock Token",
      "MTK",
    ]);
    const vaultAsset = getAddress(MockToken.address);
    const [governance, strategist, timelock, devfund, treasury, user] =
      await hre.viem.getWalletClients();

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
      vaultAsset,
      governance.account.address,
      strategist.account.address,
      controller.address,
      timelock.account.address,
    ])) as unknown as ContractTypesMap["StrategyBase"];

    // Deploy Vault
    const vault = await hre.viem.deployContract("Vault", [
      vaultAsset,
      governance.account.address,
      timelock.account.address,
      controller.address,
    ]);

    if (doSetup) {
      // Set up controller relationships
      await controller.write.setVault([vaultAsset, vault.address], {
        account: governance.account,
      });
      await controller.write.approveStrategy([vaultAsset, strategy.address], {
        account: timelock.account,
      });
      await controller.write.setStrategy([vaultAsset, strategy.address], {
        account: governance.account,
      });
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
  doVaultFactoryTests(deployVaultFactory, GammaStrategyBytecode as Address);

  doControllerTests(deployVaultWithoutFactory);

  doStrategyTests(deployVaultWithoutFactory);

  // TODO: add tests for vault, test both stakable and non-stakable strategies
});
