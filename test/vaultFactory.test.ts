import hre from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { Address, getAddress, zeroAddress } from "viem";
import { WalletClient } from "@nomicfoundation/hardhat-viem/types";
import { ContractTypesMap } from "hardhat/types";

export type DeployVaultFactoryFixture = () => Promise<{
  governance: WalletClient;
  strategist: WalletClient;
  timelock: WalletClient;
  devfund: WalletClient;
  treasury: WalletClient;
  user: WalletClient;
  vaultAsset: Address;
  VaultFactory: ContractTypesMap["IVaultFactory"];
}>;

export const doVaultFactoryTests = async (
  deploy: DeployVaultFactoryFixture,
  strategyByteCode: Address
) => {
  describe("VaultFactory Test", function () {
    it("should create a vault with proper configuration", async function () {
      const {
        governance,
        strategist,
        timelock,
        devfund,
        treasury,
        vaultAsset,
        VaultFactory,
      } = await loadFixture(deploy);

      // Create vault
      await VaultFactory.write.createVault([
        vaultAsset,
        governance.account.address,
        strategist.account.address,
        timelock.account.address,
        devfund.account.address,
        treasury.account.address,
      ]);

      // Get vault address
      const vaultAddress = await VaultFactory.read.vaults([vaultAsset]);
      expect(vaultAddress).to.not.equal(zeroAddress);

      // Get controller address
      const controllerAddress = await VaultFactory.read.controllers([
        vaultAddress,
      ]);
      expect(controllerAddress).to.not.equal(zeroAddress);

      // Get strategy address
      const strategyAddress = await VaultFactory.read.strategies([
        vaultAddress,
      ]);
      expect(strategyAddress).to.not.equal(zeroAddress);

      // Verify vault configuration
      const Vault = await hre.viem.getContractAt("Vault", vaultAddress);
      expect(await Vault.read.token()).to.equal(vaultAsset);
      expect(await Vault.read.governance()).to.equal(
        getAddress(governance.account.address)
      );
      expect(await Vault.read.timelock()).to.equal(
        getAddress(timelock.account.address)
      );
      expect(await Vault.read.controller()).to.equal(controllerAddress);

      // Verify controller configuration
      const Controller = await hre.viem.getContractAt(
        "Controller",
        controllerAddress
      );
      expect(await Controller.read.strategies([vaultAsset])).to.equal(
        strategyAddress
      );
      expect(await Controller.read.vaults([vaultAsset])).to.equal(vaultAddress);
      expect(
        await Controller.read.approvedStrategies([vaultAsset, strategyAddress])
      ).to.be.true;
      expect(await Controller.read.governance()).to.equal(
        getAddress(governance.account.address)
      );
      expect(await Controller.read.strategist()).to.equal(
        getAddress(strategist.account.address)
      );
      expect(await Controller.read.timelock()).to.equal(
        getAddress(timelock.account.address)
      );
      expect(await Controller.read.devfund()).to.equal(
        getAddress(devfund.account.address)
      );
      expect(await Controller.read.treasury()).to.equal(
        getAddress(treasury.account.address)
      );

      // Verify strategy configuration
      const Strategy = await hre.viem.getContractAt(
        "GammaStrategy",
        strategyAddress
      );
      expect(await Strategy.read.want()).to.equal(vaultAsset);
      expect(await Strategy.read.governance()).to.equal(
        getAddress(governance.account.address)
      );
      expect(await Strategy.read.strategist()).to.equal(
        getAddress(strategist.account.address)
      );
      expect(await Strategy.read.controller()).to.equal(controllerAddress);
      expect(await Strategy.read.timelock()).to.equal(
        getAddress(timelock.account.address)
      );
    });

    it("should fail when non-governance tries to create vault", async function () {
      const {
        governance,
        strategist,
        timelock,
        devfund,
        treasury,
        user,
        vaultAsset,
        VaultFactory,
      } = await loadFixture(deploy);

      // Try to create vault from non-governance account
      await expect(
        VaultFactory.write.createVault(
          [
            vaultAsset,
            governance.account.address,
            strategist.account.address,
            timelock.account.address,
            devfund.account.address,
            treasury.account.address,
          ],
          { account: user.account }
        )
      ).to.be.rejectedWith("Caller is not the governance");
    });

    it("should create vault with custom strategy bytecode", async function () {
      const {
        governance,
        strategist,
        timelock,
        devfund,
        treasury,
        vaultAsset,
        VaultFactory,
      } = await loadFixture(deploy);

      if (!strategyByteCode) throw new Error("Failed to get strategy bytecode");

      // Create vault with custom strategy bytecode
      await VaultFactory.write.createVault([
        vaultAsset,
        governance.account.address,
        strategist.account.address,
        timelock.account.address,
        devfund.account.address,
        treasury.account.address,
        strategyByteCode as `0x${string}`,
        "0x", // no extra params
      ]);

      // Verify vault was created
      const vaultAddress = await VaultFactory.read.vaults([vaultAsset]);
      expect(vaultAddress).to.not.equal(zeroAddress);
    });
  });
};
