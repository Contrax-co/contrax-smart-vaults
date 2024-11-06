import hre from "hardhat";
import { Address, encodeAbiParameters, parseEther, zeroAddress } from "viem";
import { bytecode as MockStrategyBytecode } from "../artifacts/contracts/mocks/MockStrategy.sol/MockStrategy.json";
import { DeployFixture, doProtocolTest } from "./protocol.test";
import { ContractTypesMap } from "hardhat/types";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { testVaultConfiguration } from "./vaultFactory.test";

const doMockTest = async () => {
  const getDeployFixtureManualSetup = (asset: Address): DeployFixture => {
    return async () => {
      const [governance, strategist, timelock, devfund, treasury, user] = await hre.viem.getWalletClients();

      const vaultAsset = await hre.viem.deployContract("MockERC20", ["Mock Token", "MTK"]);

      // just for compatibility with the vault factory test
      const VaultFactory = await hre.viem.deployContract("MockVaultFactory", [governance.account.address]);

      // Deploy Mock vault asset
      const rewardToken = await hre.viem.deployContract("MockERC20", ["Reward Token", "RWT"]);
      const staking = await hre.viem.deployContract("MockStaking", [vaultAsset.address, rewardToken.address]);

      // Deploy Controller first
      const controller = await hre.viem.deployContract("Controller", [
        governance.account.address,
        strategist.account.address,
        timelock.account.address,
        devfund.account.address,
        treasury.account.address,
      ]);

      // Deploy Strategy
      const strategy = (await hre.viem.deployContract("MockStrategy", [
        vaultAsset.address,
        governance.account.address,
        strategist.account.address,
        controller.address,
        timelock.account.address,
        staking.address,
      ])) as unknown as ContractTypesMap["StrategyBase"];

      // Deploy Vault
      const vault = await hre.viem.deployContract("Vault", [
        vaultAsset.address,
        governance.account.address,
        timelock.account.address,
        controller.address,
      ]);

      await vaultAsset.write.mint([user.account.address, parseEther("1000000")]);
      await controller.write.setVault([vaultAsset.address, vault.address], {
        account: governance.account,
      });
      await controller.write.approveStrategy([vaultAsset.address, strategy.address], {
        account: timelock.account,
      });
      await controller.write.setStrategy([vaultAsset.address, strategy.address], {
        account: governance.account,
      });

      return {
        stakable: false,
        governance,
        strategist,
        timelock,
        devfund,
        treasury,
        user,
        vaultAsset: vaultAsset as unknown as ContractTypesMap["ERC20"],
        vault,
        strategy: strategy as unknown as ContractTypesMap["StrategyBase"],
        controller,
        VaultFactory: VaultFactory as unknown as ContractTypesMap["VaultFactoryBase"],
        strategyBytecode: MockStrategyBytecode as Address,
        strategyExtraParams: encodeAbiParameters([{ type: "address" }], [staking.address]),
      };
    };
  };

  const getDeployFixtureVaultFactorySetup = (asset: Address): DeployFixture => {
    return async () => {
      const [governance, strategist, timelock, devfund, treasury, user] = await hre.viem.getWalletClients();

      const vaultAsset = await hre.viem.deployContract("MockERC20", ["Mock Token", "MTK"]);

      const VaultFactory = await hre.viem.deployContract("MockVaultFactory", [governance.account.address]);

      // Deploy Mock vault asset
      const rewardToken = await hre.viem.deployContract("MockERC20", ["Reward Token", "RWT"]);
      const staking = await hre.viem.deployContract("MockStaking", [vaultAsset.address, rewardToken.address]);

      // Create vault with custom strategy bytecode
      await expect(
        VaultFactory.write.createVault([
          vaultAsset.address,
          governance.account.address,
          strategist.account.address,
          timelock.account.address,
          devfund.account.address,
          treasury.account.address,
          staking.address,
        ])
      ).to.emit(VaultFactory, "VaultCreated");

      const vaultAddress = await VaultFactory.read.vaults([vaultAsset.address]);
      const controllerAddress = await VaultFactory.read.controllers([vaultAddress]);
      const strategyAddress = await VaultFactory.read.strategies([vaultAddress]);

      const controller = await hre.viem.getContractAt("Controller", controllerAddress);
      const vault = await hre.viem.getContractAt("Vault", vaultAddress);
      const strategy = await hre.viem.getContractAt("StrategyBase", strategyAddress);

      await vaultAsset.write.mint([user.account.address, parseEther("1000000")]);

      return {
        stakable: false,
        governance,
        strategist,
        timelock,
        devfund,
        treasury,
        user,
        vaultAsset: vaultAsset as unknown as ContractTypesMap["ERC20"],
        vault,
        strategy: strategy as unknown as ContractTypesMap["StrategyBase"],
        controller,
        VaultFactory: VaultFactory as unknown as ContractTypesMap["VaultFactoryBase"],
        strategyBytecode: MockStrategyBytecode as Address,
        strategyExtraParams: encodeAbiParameters([{ type: "address" }], [staking.address]),
      };
    };
  };

  describe("Mock Test", function () {
    it("should create a mock vault with proper configuration", async function () {
      const { governance, strategist, timelock, devfund, treasury, vaultAsset, VaultFactory } = await loadFixture(
        getDeployFixtureVaultFactorySetup("0x")
      );

      // Verify vault was created
      const vaultAddress = await VaultFactory.read.vaults([vaultAsset.address]);
      expect(vaultAddress).to.not.equal(zeroAddress);

      await testVaultConfiguration(
        VaultFactory as unknown as ContractTypesMap["VaultFactoryBase"],
        vaultAsset,
        governance,
        strategist,
        timelock,
        devfund,
        treasury
      );
    });

    it("should fail when non-governance tries to create vault", async function () {
      const { governance, strategist, timelock, devfund, treasury, user, vaultAsset, VaultFactory } = await loadFixture(
        getDeployFixtureVaultFactorySetup("0x")
      );

      // Try to create vault from non-governance account
      await expect(
        (VaultFactory as unknown as ContractTypesMap["MockVaultFactory"]).write.createVault(
          [
            vaultAsset.address,
            governance.account.address,
            strategist.account.address,
            timelock.account.address,
            devfund.account.address,
            treasury.account.address,
            treasury.account.address, // temp staking address
          ],
          { account: governance.account }
        )
      ).to.be.rejectedWith("already exists");

      await expect(
        (VaultFactory as unknown as ContractTypesMap["MockVaultFactory"]).write.createVault(
          [
            treasury.account.address, // temp token address
            governance.account.address,
            strategist.account.address,
            timelock.account.address,
            devfund.account.address,
            treasury.account.address,
            treasury.account.address, // temp staking address
          ],
          { account: user.account }
        )
      ).to.be.rejectedWith("!governance");
    });
  });

  doProtocolTest({
    protocolName: "Mock with manual setup",
    vaultAssets: ["0x"],
    getDeployFixture: getDeployFixtureManualSetup,
  });

  doProtocolTest({
    protocolName: "Mock with factory setup",
    vaultAssets: ["0x"],
    getDeployFixture: getDeployFixtureVaultFactorySetup,
  });
};

doMockTest();
