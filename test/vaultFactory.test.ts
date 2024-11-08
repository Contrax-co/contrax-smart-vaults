import hre from "hardhat";
import { expect } from "chai";
import { getAddress, zeroAddress } from "viem";
import { WalletClient } from "@nomicfoundation/hardhat-viem/types";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { ContractTypesMap } from "hardhat/types";
import { DeployFixture } from "./protocol.test";

export const doVaultFactoryTests = (deploy: DeployFixture) => {
  describe("VaultFactory Tests", function () {
    it("should create vault with custom strategy bytecode with proper configuration", async function () {
      const {
        governance,
        strategist,
        timelock,
        devfund,
        treasury,
        vaultFactory: VaultFactory,
        strategyBytecode,
        strategyExtraParams,
      } = await loadFixture(deploy);

      if (!strategyBytecode) throw new Error("Failed to get strategy bytecode");

      // Deploy a mock token to use as the vault's asset
      const vaultAsset = await hre.viem.deployContract("MockERC20", ["Mock Token", "MTK"]);

      // Create vault with custom strategy bytecode and verify all configurations
      await VaultFactory.write.createVault([
        vaultAsset.address, // use some other token
        governance.account.address,
        strategist.account.address,
        timelock.account.address,
        devfund.account.address,
        treasury.account.address,
        strategyBytecode,
        strategyExtraParams,
      ]);

      // Verify vault was created with non-zero address
      const vaultAddress = await VaultFactory.read.vaults([vaultAsset.address]);
      expect(vaultAddress).to.not.equal(zeroAddress);

      // Test all component configurations
      await testVaultConfiguration(
        VaultFactory,
        vaultAsset as unknown as ContractTypesMap["ERC20"],
        governance,
        strategist,
        timelock,
        devfund,
        treasury
      );
    });

    /**
     * Tests access control for vault creation.
     * Verifies that only governance can create new vaults.
     * Attempts to create a vault from a non-governance account and expects it to fail.
     */
    it("should fail when non-governance tries to create vault with custom strategy bytecode", async function () {
      const {
        governance,
        strategist,
        timelock,
        devfund,
        treasury,
        user,
        vaultAsset,
        vaultFactory: VaultFactory,
        strategyBytecode,
        strategyExtraParams,
      } = await loadFixture(deploy);

      // Attempt vault creation from non-governance account (should fail)
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

/**
 * Helper function to verify the complete configuration of a newly created vault system.
 * Checks:
 * 1. Vault exists and is properly linked to its asset
 * 2. Controller exists and is properly configured
 * 3. Strategy exists and is properly linked
 * 4. All governance roles are correctly set
 * 5. All component relationships are properly established
 */
export const testVaultConfiguration = async (
  VaultFactory: ContractTypesMap["VaultFactoryBase"],
  vaultAsset: ContractTypesMap["ERC20"],
  governance: WalletClient,
  strategist: WalletClient,
  timelock: WalletClient,
  devfund: WalletClient,
  treasury: WalletClient
) => {
  // Verify vault was deployed and registered
  const vaultAddress = await VaultFactory.read.vaults([vaultAsset.address]);
  expect(vaultAddress).to.not.equal(zeroAddress);

  // Verify controller was deployed and linked
  const controllerAddress = await VaultFactory.read.controllers([vaultAddress]);
  expect(controllerAddress).to.not.equal(zeroAddress);

  // Verify strategy was deployed and linked
  const strategyAddress = await VaultFactory.read.strategies([vaultAddress]);
  expect(strategyAddress).to.not.equal(zeroAddress);

  // Verify vault configuration and permissions
  const Vault = await hre.viem.getContractAt("Vault", vaultAddress);
  expect(await Vault.read.token()).to.equal(getAddress(vaultAsset.address));
  expect(await Vault.read.governance()).to.equal(getAddress(governance.account.address));
  expect(await Vault.read.timelock()).to.equal(getAddress(timelock.account.address));
  expect(await Vault.read.controller()).to.equal(controllerAddress);

  // Verify controller configuration, strategy approval, and permissions
  const Controller = await hre.viem.getContractAt("Controller", controllerAddress);
  expect(await Controller.read.strategies([vaultAsset.address])).to.equal(strategyAddress);
  expect(await Controller.read.vaults([vaultAsset.address])).to.equal(vaultAddress);
  expect(await Controller.read.approvedStrategies([vaultAsset.address, strategyAddress])).to.be.true;
  expect(await Controller.read.governance()).to.equal(getAddress(governance.account.address));
  expect(await Controller.read.strategist()).to.equal(getAddress(strategist.account.address));
  expect(await Controller.read.timelock()).to.equal(getAddress(timelock.account.address));
  expect(await Controller.read.devfund()).to.equal(getAddress(devfund.account.address));
  expect(await Controller.read.treasury()).to.equal(getAddress(treasury.account.address));

  // Verify strategy configuration and permissions
  const Strategy = await hre.viem.getContractAt("IStrategy", strategyAddress);
  expect(await Strategy.read.want()).to.equal(getAddress(vaultAsset.address));
  expect(await Strategy.read.governance()).to.equal(getAddress(governance.account.address));
  expect(await Strategy.read.strategist()).to.equal(getAddress(strategist.account.address));
  expect(await Strategy.read.controller()).to.equal(controllerAddress);
  expect(await Strategy.read.timelock()).to.equal(getAddress(timelock.account.address));
};
