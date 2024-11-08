import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress, parseEther } from "viem";
import { DeployFixture } from "./protocol.test";

export const doVaultTests = (deploy: DeployFixture) => {
  describe("Vault Test", function () {
    // Test initialization parameters of the vault
    it("should initialize with correct parameters", async function () {
      const { governance, timelock, controller, vaultAsset, vault } = await loadFixture(deploy);

      // Verify all core vault parameters are set correctly during deployment
      expect(await vault.read.token()).to.equal(getAddress(vaultAsset.address));
      expect(await vault.read.governance()).to.equal(getAddress(governance.account.address));
      expect(await vault.read.timelock()).to.equal(getAddress(timelock.account.address));
      expect(await vault.read.controller()).to.equal(getAddress(controller.address));
      // Verify min/max ratio for available funds (5% minimum must stay in vault)
      expect(await vault.read.min()).to.equal(9500n);
      expect(await vault.read.max()).to.equal(10000n);
    });

    // Test basic deposit functionality and share calculation
    it("should allow deposits and mints correct shares", async function () {
      const { user, vault, vaultAsset } = await loadFixture(deploy);
      const depositAmount = parseEther("100");

      // First approve vault to spend user's tokens
      await vaultAsset.write.approve([await vault.address, depositAmount], {
        account: user.account,
      });

      // Perform deposit
      await vault.write.deposit([depositAmount], { account: user.account });

      // Verify user received correct amount of shares
      // For first deposit, share amount should equal deposit amount
      expect(await vault.read.balanceOf([user.account.address])).to.equal(depositAmount);
      expect(await vault.read.totalSupply()).to.equal(depositAmount);
    });

    // Test withdrawal functionality and share burning
    it("should allow withdrawals and burns correct shares", async function () {
      const { user, vault: Vault, vaultAsset: vaultAsset } = await loadFixture(deploy);
      const depositAmount = parseEther("100");

      // Setup: First deposit tokens to test withdrawal
      await vaultAsset.write.approve([await Vault.address, depositAmount], {
        account: user.account,
      });
      await Vault.write.deposit([depositAmount], { account: user.account });

      // Test complete withdrawal using withdrawAll()
      await Vault.write.withdrawAll({ account: user.account });

      // Verify all shares are burned and balance is zero
      expect(await Vault.read.balanceOf([user.account.address])).to.equal(0n);
      expect(await Vault.read.totalSupply()).to.equal(0n);
    });

    // Test access control for min ratio setting
    it("should only allow governance to set min", async function () {
      const { governance, user, vault: Vault } = await loadFixture(deploy);
      const newMin = 9600n;

      // Verify non-governance address cannot set min ratio
      await expect(Vault.write.setMin([newMin], { account: user.account })).to.be.rejectedWith("!governance");

      // Verify governance can successfully set min ratio
      await Vault.write.setMin([newMin], { account: governance.account });
      expect(await Vault.read.min()).to.equal(newMin);
    });

    // Test access control for governance transfer
    it("should only allow governance to set governance", async function () {
      const { governance, user, vault: Vault } = await loadFixture(deploy);
      const newGovernance = user.account.address;

      // Verify non-governance address cannot change governance
      await expect(Vault.write.setGovernance([newGovernance], { account: user.account })).to.be.rejectedWith(
        "!governance"
      );

      // Verify current governance can transfer control
      await Vault.write.setGovernance([newGovernance], {
        account: governance.account,
      });
      expect(await Vault.read.governance()).to.equal(getAddress(newGovernance));
    });

    // Test access control for timelock transfer
    it("should only allow timelock to set timelock", async function () {
      const { timelock, user, vault: Vault } = await loadFixture(deploy);
      const newTimelock = user.account.address;

      // Verify non-timelock address cannot change timelock
      await expect(Vault.write.setTimelock([newTimelock], { account: user.account })).to.be.rejectedWith("!timelock");

      // Verify current timelock can transfer control
      await Vault.write.setTimelock([newTimelock], {
        account: timelock.account,
      });
      expect(await Vault.read.timelock()).to.equal(getAddress(newTimelock));
    });

    // Test share price calculation
    it("should calculate correct share price ratio", async function () {
      const { user, vault: Vault, vaultAsset: vaultAsset } = await loadFixture(deploy);
      const depositAmount = parseEther("100");

      // Make initial deposit to test share price
      await vaultAsset.write.approve([await Vault.address, depositAmount], {
        account: user.account,
      });
      await Vault.write.deposit([depositAmount], { account: user.account });

      // Initial ratio should be 1:1 (1e18) when first depositing
      expect(await Vault.read.getRatio()).to.equal(parseEther("1"));
    });

    // Test deposit event emission
    it("should emit Deposit event", async function () {
      const { user, vault: Vault, vaultAsset } = await loadFixture(deploy);
      const depositAmount = parseEther("100");

      // Setup deposit approval
      await vaultAsset.write.approve([await Vault.address, depositAmount], {
        account: user.account,
      });

      // Verify Deposit event is emitted when depositing
      await expect(
        Vault.write.deposit([depositAmount], {
          account: user.account,
        })
      ).to.emit(Vault, "Deposit");
    });
  });
};
