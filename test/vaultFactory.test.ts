import hre from "hardhat";
import { expect } from "chai";
import { getAddress, zeroAddress } from "viem";
import { WalletClient } from "@nomicfoundation/hardhat-viem/types";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { ContractTypesMap } from "hardhat/types";
import { DeployFixture } from "./protocol.test";

export const doVaultFactoryTests = (deploy: DeployFixture) => {
  describe("VaultFactory Tests", function () {
    it.skip("should create vault with custom strategy bytecode with proper configuration", async function () {
      const {
        governance,
        strategist,
        timelock,
        devfund,
        treasury,
        vaultAsset,
        VaultFactory,
        strategyBytecode,
        strategyExtraParams,
      } = await loadFixture(deploy);

      if (!strategyBytecode) throw new Error("Failed to get strategy bytecode");

      // Create vault with custom strategy bytecode
      await VaultFactory.write.createVault([
        governance.account.address,
        governance.account.address,
        strategist.account.address,
        timelock.account.address,
        devfund.account.address,
        treasury.account.address,
        strategyBytecode,
        strategyExtraParams, // extra params
      ]);

      // Verify vault was created
      const vaultAddress = await VaultFactory.read.vaults([vaultAsset.address]);
      expect(vaultAddress).to.not.equal(zeroAddress);

      await testVaultConfiguration(VaultFactory, vaultAsset, governance, strategist, timelock, devfund, treasury);
    });

    it("should fail when non-governance tries to create vault with custom strategy bytecode", async function () {
      const {
        governance,
        strategist,
        timelock,
        devfund,
        treasury,
        user,
        vaultAsset,
        VaultFactory,
        strategyBytecode,
        strategyExtraParams,
      } = await loadFixture(deploy);

      // Try to create vault from non-governance account
      await expect(
        VaultFactory.write.createVault(
          [
            vaultAsset.address,
            governance.account.address,
            strategist.account.address,
            timelock.account.address,
            devfund.account.address,
            treasury.account.address,
            strategyBytecode,
            strategyExtraParams,
          ],
          { account: user.account }
        )
      ).to.be.rejectedWith("!governance");
    });
  });
};

export const testVaultConfiguration = async (
  VaultFactory: ContractTypesMap["VaultFactoryBase"],
  vaultAsset: ContractTypesMap["ERC20"],
  governance: WalletClient,
  strategist: WalletClient,
  timelock: WalletClient,
  devfund: WalletClient,
  treasury: WalletClient
) => {
  // Get vault address
  const vaultAddress = await VaultFactory.read.vaults([vaultAsset.address]);
  expect(vaultAddress).to.not.equal(zeroAddress);

  // Get controller address
  const controllerAddress = await VaultFactory.read.controllers([vaultAddress]);
  expect(controllerAddress).to.not.equal(zeroAddress);

  // Get strategy address
  const strategyAddress = await VaultFactory.read.strategies([vaultAddress]);
  expect(strategyAddress).to.not.equal(zeroAddress);

  // Verify vault configuration
  const Vault = await hre.viem.getContractAt("Vault", vaultAddress);
  expect(await Vault.read.token()).to.equal(getAddress(vaultAsset.address));
  expect(await Vault.read.governance()).to.equal(getAddress(governance.account.address));
  expect(await Vault.read.timelock()).to.equal(getAddress(timelock.account.address));
  expect(await Vault.read.controller()).to.equal(controllerAddress);

  // Verify controller configuration
  const Controller = await hre.viem.getContractAt("Controller", controllerAddress);
  expect(await Controller.read.strategies([vaultAsset.address])).to.equal(strategyAddress);
  expect(await Controller.read.vaults([vaultAsset.address])).to.equal(vaultAddress);
  expect(await Controller.read.approvedStrategies([vaultAsset.address, strategyAddress])).to.be.true;
  expect(await Controller.read.governance()).to.equal(getAddress(governance.account.address));
  expect(await Controller.read.strategist()).to.equal(getAddress(strategist.account.address));
  expect(await Controller.read.timelock()).to.equal(getAddress(timelock.account.address));
  expect(await Controller.read.devfund()).to.equal(getAddress(devfund.account.address));
  expect(await Controller.read.treasury()).to.equal(getAddress(treasury.account.address));

  // Verify strategy configuration
  const Strategy = await hre.viem.getContractAt("IStrategy", strategyAddress);
  expect(await Strategy.read.want()).to.equal(getAddress(vaultAsset.address));
  expect(await Strategy.read.governance()).to.equal(getAddress(governance.account.address));
  expect(await Strategy.read.strategist()).to.equal(getAddress(strategist.account.address));
  expect(await Strategy.read.controller()).to.equal(controllerAddress);
  expect(await Strategy.read.timelock()).to.equal(getAddress(timelock.account.address));
};
