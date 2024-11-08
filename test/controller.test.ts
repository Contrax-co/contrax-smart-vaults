import hre from "hardhat";
import { expect } from "chai";
import { getAddress, maxUint256, parseEther } from "viem";
import { DeployFixture } from "./protocol.test";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

export const doControllerTests = async (deploy: DeployFixture) => {
  describe("Controller Test", function () {
    // Test initial configuration of the controller contract
    it("should be initialized with correct configuration", async function () {
      const { governance, strategist, timelock, devfund, treasury, controller, vaultAsset, vault, strategy } =
        await loadFixture(deploy);

      // Verify vault and strategy mappings
      expect(await controller.read.vaults([vaultAsset.address])).to.equal(getAddress(vault.address));
      expect(await controller.read.strategies([vaultAsset.address])).to.equal(getAddress(strategy.address));
      expect(await controller.read.approvedStrategies([vaultAsset.address, strategy.address])).to.be.true;

      // Verify all admin addresses are set correctly
      expect(await controller.read.governance()).to.equal(getAddress(governance.account.address));
      expect(await controller.read.strategist()).to.equal(getAddress(strategist.account.address));
      expect(await controller.read.timelock()).to.equal(getAddress(timelock.account.address));
      expect(await controller.read.devfund()).to.equal(getAddress(devfund.account.address));
      expect(await controller.read.treasury()).to.equal(getAddress(treasury.account.address));
    });

    // Test governance's ability to update admin addresses
    it("should allow governance to set new addresses", async function () {
      const { governance, user, controller } = await loadFixture(deploy);

      // Test updating each admin role one by one
      // Only governance should be able to update these roles
      await controller.write.setDevFund([user.account.address], {
        account: governance.account,
      });
      expect(await controller.read.devfund()).to.equal(getAddress(user.account.address));

      await controller.write.setTreasury([user.account.address], {
        account: governance.account,
      });
      expect(await controller.read.treasury()).to.equal(getAddress(user.account.address));

      await controller.write.setStrategist([user.account.address], {
        account: governance.account,
      });
      expect(await controller.read.strategist()).to.equal(getAddress(user.account.address));

      await controller.write.setGovernance([user.account.address], {
        account: governance.account,
      });
      expect(await controller.read.governance()).to.equal(getAddress(user.account.address));
    });

    // Test timelock's exclusive ability to update timelock address
    it("should allow timelock to set new timelock", async function () {
      const { timelock, user, controller } = await loadFixture(deploy);

      await controller.write.setTimelock([user.account.address], {
        account: timelock.account,
      });
      expect(await controller.read.timelock()).to.equal(getAddress(user.account.address));
    });

    // Test access control for admin functions
    it("should fail when unauthorized users try to set addresses", async function () {
      const { user, controller } = await loadFixture(deploy);

      // Verify that a regular user cannot update any admin roles
      await expect(
        controller.write.setDevFund([user.account.address], {
          account: user.account,
        })
      ).to.be.rejectedWith("!governance");

      await expect(
        controller.write.setTreasury([user.account.address], {
          account: user.account,
        })
      ).to.be.rejectedWith("!governance");

      await expect(
        controller.write.setStrategist([user.account.address], {
          account: user.account,
        })
      ).to.be.rejectedWith("!governance");

      await expect(
        controller.write.setGovernance([user.account.address], {
          account: user.account,
        })
      ).to.be.rejectedWith("!governance");

      await expect(
        controller.write.setTimelock([user.account.address], {
          account: user.account,
        })
      ).to.be.rejectedWith("!timelock");
    });

    // Test strategy approval and revocation workflow
    it("should handle strategy approval and revocation correctly", async function () {
      const { governance, timelock, vaultAsset, user, controller, strategy } = await loadFixture(deploy);

      // Verify initial strategy is approved
      expect(await controller.read.approvedStrategies([vaultAsset.address, strategy.address])).to.be.true;

      const mockStrategy = user.account.address; // Using user address as mock strategy

      // Test strategy approval by timelock
      await controller.write.approveStrategy([vaultAsset.address, mockStrategy], {
        account: timelock.account,
      });
      expect(await controller.read.approvedStrategies([vaultAsset.address, mockStrategy])).to.be.true;

      // Test strategy revocation by governance
      await controller.write.revokeStrategy([vaultAsset.address, mockStrategy], {
        account: governance.account,
      });
      expect(await controller.read.approvedStrategies([vaultAsset.address, mockStrategy])).to.be.false;
    });

    // Test protection against revoking active strategies
    it("should not revoke active strategy", async function () {
      const { governance, vaultAsset, controller, strategy } = await loadFixture(deploy);
      expect(await controller.read.approvedStrategies([vaultAsset.address, strategy.address])).to.be.true;

      // Attempt to revoke active strategy should fail
      await expect(
        controller.write.revokeStrategy([vaultAsset.address, strategy.address], {
          account: governance.account,
        })
      ).to.be.revertedWith("cannot revoke active strategy");
      expect(await controller.read.approvedStrategies([vaultAsset.address, strategy.address])).to.be.true;
    });

    // Test strategy migration process
    it("should handle set new strategy and transfer all strategy balance to vault", async function () {
      const { governance, timelock, vaultAsset, user, controller, strategy, vault } = await loadFixture(deploy);

      // Setup initial state with funds in the strategy
      await vaultAsset.write.approve([vault.address, maxUint256]);
      await vault.write.depositAll();
      await vault.write.earn();

      const oldStrategyBalance = await vaultAsset.read.balanceOf([strategy.address]);
      const mockStrategy = user.account.address;

      // Test complete strategy migration process
      await controller.write.approveStrategy([vaultAsset.address, mockStrategy], {
        account: timelock.account,
      });
      expect(await controller.read.approvedStrategies([vaultAsset.address, mockStrategy])).to.be.true;

      // Verify vault has no balance before migration
      expect(await vaultAsset.read.balanceOf([vault.address])).to.be.eq(0n);

      // Perform strategy migration
      await controller.write.setStrategy([vaultAsset.address, mockStrategy]);

      // Revoke old strategy after migration
      await controller.write.revokeStrategy([vaultAsset.address, strategy.address], {
        account: governance.account,
      });
      expect(await controller.read.approvedStrategies([vaultAsset.address, strategy.address])).to.be.false;
      // Verify funds have moved correctly
      expect(await vaultAsset.read.balanceOf([strategy.address])).to.be.eq(0n);
      expect(await vaultAsset.read.balanceOf([vault.address])).to.be.eq(oldStrategyBalance);
    });

    // Test vault setting restrictions
    it("should allow strategist or governance to set vault", async function () {
      const { governance, vaultAsset, user, controller } = await loadFixture(deploy);

      const mockVault = user.account.address;

      // Verify cannot set vault address twice
      await expect(
        controller.write.setVault([vaultAsset.address, mockVault], {
          account: governance.account,
        })
      ).to.be.rejectedWith("vault already set");
    });

    // Test emergency functions access control
    it("should not allow emergency token withdraw without governance or strategist", async function () {
      const { vaultAsset, user, controller, strategy } = await loadFixture(deploy);

      // Verify regular users cannot access emergency functions
      await expect(
        controller.write.inCaseTokensGetStuck([vaultAsset.address, 1n], {
          account: user.account,
        })
      ).to.be.rejectedWith("!governance");

      await expect(
        controller.write.inCaseStrategyTokenGetStuck([strategy.address, vaultAsset.address], {
          account: user.account,
        })
      ).to.be.rejectedWith("!governance");
    });

    // Test emergency token recovery from controller
    it("should allow inCaseTokensGetStuck", async function () {
      const { vaultAsset, user, controller, governance } = await loadFixture(deploy);

      // Setup test by sending tokens to controller
      const governanceBalanceBefore = await vaultAsset.read.balanceOf([governance.account.address]);
      const controllerBalance = (await vaultAsset.read.balanceOf([user.account.address])) / 2n;
      await vaultAsset.write.transfer([controller.address, controllerBalance], {
        account: user.account,
      });

      // Recover stuck tokens
      await controller.write.inCaseTokensGetStuck([vaultAsset.address, controllerBalance], {
        account: governance.account,
      });

      // Verify tokens were recovered
      const governanceBalanceAfter = await vaultAsset.read.balanceOf([governance.account.address]);
      expect(governanceBalanceAfter).to.be.eq(governanceBalanceBefore + controllerBalance);
    });

    // Test emergency token recovery from strategy
    it("should allow inCaseStrategyTokenGetStuck", async function () {
      const { controller, strategy, governance } = await loadFixture(deploy);

      // Setup test with mock token stuck in strategy
      const mockToken = await hre.viem.deployContract("MockERC20", ["Mock Token", "MTK"]);
      await mockToken.write.mint([strategy.address, parseEther("1000000")]);

      const initialStrategyBalance = await mockToken.read.balanceOf([strategy.address]);
      const controllerBalanceBefore = await mockToken.read.balanceOf([controller.address]);

      // Recover stuck tokens from strategy
      await controller.write.inCaseStrategyTokenGetStuck([strategy.address, mockToken.address], {
        account: governance.account,
      });

      // Verify tokens were recovered
      const increasedControllerBalance =
        (await mockToken.read.balanceOf([controller.address])) - controllerBalanceBefore;

      await expect(initialStrategyBalance).to.be.eq(increasedControllerBalance);
    });
  });
};
