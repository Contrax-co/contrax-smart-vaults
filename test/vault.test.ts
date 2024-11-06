import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress, parseEther } from "viem";
import { DeployFixture } from "./protocol.test";

export const doVaultTests = (deploy: DeployFixture) => {
  describe("Vault Test", function () {
    it("should initialize with correct parameters", async function () {
      const { governance, timelock, controller, vaultAsset, vault } = await loadFixture(deploy);

      expect(await vault.read.token()).to.equal(getAddress(vaultAsset.address));
      expect(await vault.read.governance()).to.equal(getAddress(governance.account.address));
      expect(await vault.read.timelock()).to.equal(getAddress(timelock.account.address));
      expect(await vault.read.controller()).to.equal(getAddress(controller.address));
      expect(await vault.read.min()).to.equal(9500n);
      expect(await vault.read.max()).to.equal(10000n);
    });

    it("should allow deposits and mints correct shares", async function () {
      const { user, vault, vaultAsset } = await loadFixture(deploy);
      const depositAmount = parseEther("100");

      // Approve token spending
      await vaultAsset.write.approve([await vault.address, depositAmount], {
        account: user.account,
      });

      // Deposit tokens
      await vault.write.deposit([depositAmount], { account: user.account });

      // Check balances and shares
      expect(await vault.read.balanceOf([user.account.address])).to.equal(depositAmount);
      expect(await vault.read.totalSupply()).to.equal(depositAmount);
    });

    it("should allow withdrawals and burns correct shares", async function () {
      const { user, vault: Vault, vaultAsset: vaultAsset } = await loadFixture(deploy);
      const depositAmount = parseEther("100");

      // Setup: Deposit first
      await vaultAsset.write.approve([await Vault.address, depositAmount], {
        account: user.account,
      });
      await Vault.write.deposit([depositAmount], { account: user.account });

      // Withdraw all
      await Vault.write.withdrawAll({ account: user.account });

      // Check balances and shares
      expect(await Vault.read.balanceOf([user.account.address])).to.equal(0n);
      expect(await Vault.read.totalSupply()).to.equal(0n);
    });

    it("should only allow governance to set min", async function () {
      const { governance, user, vault: Vault } = await loadFixture(deploy);
      const newMin = 9600n;

      // Should fail when non-governance tries to set min
      await expect(Vault.write.setMin([newMin], { account: user.account })).to.be.rejectedWith("!governance");

      // Should succeed when governance sets min
      await Vault.write.setMin([newMin], { account: governance.account });
      expect(await Vault.read.min()).to.equal(newMin);
    });

    it("should only allow governance to set governance", async function () {
      const { governance, user, vault: Vault } = await loadFixture(deploy);
      const newGovernance = user.account.address;

      // Should fail when non-governance tries to set governance
      await expect(Vault.write.setGovernance([newGovernance], { account: user.account })).to.be.rejectedWith(
        "!governance"
      );

      // Should succeed when governance sets new governance
      await Vault.write.setGovernance([newGovernance], {
        account: governance.account,
      });
      expect(await Vault.read.governance()).to.equal(getAddress(newGovernance));
    });

    it("should only allow timelock to set timelock", async function () {
      const { timelock, user, vault: Vault } = await loadFixture(deploy);
      const newTimelock = user.account.address;

      // Should fail when non-timelock tries to set timelock
      await expect(Vault.write.setTimelock([newTimelock], { account: user.account })).to.be.rejectedWith("!timelock");

      // Should succeed when timelock sets new timelock
      await Vault.write.setTimelock([newTimelock], {
        account: timelock.account,
      });
      expect(await Vault.read.timelock()).to.equal(getAddress(newTimelock));
    });

    it("should calculate correct share price ratio", async function () {
      const { user, vault: Vault, vaultAsset: vaultAsset } = await loadFixture(deploy);
      const depositAmount = parseEther("100");

      // Initial deposit
      await vaultAsset.write.approve([await Vault.address, depositAmount], {
        account: user.account,
      });
      await Vault.write.deposit([depositAmount], { account: user.account });

      // Check initial ratio (should be 1e18 when price = 1)
      expect(await Vault.read.getRatio()).to.equal(parseEther("1"));
    });

    it("should emit Deposit event with correct parameters", async function () {
      const { user, vault: Vault, vaultAsset } = await loadFixture(deploy);
      const depositAmount = parseEther("100");

      // Approve and deposit
      await vaultAsset.write.approve([await Vault.address, depositAmount], {
        account: user.account,
      });

      // Watch for Deposit event
      await expect(
        Vault.write.deposit([depositAmount], {
          account: user.account,
        })
      ).to.emit(Vault, "Deposit");
    });
  });
};
