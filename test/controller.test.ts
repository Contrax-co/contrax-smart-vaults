import { expect } from "chai";
import { getAddress } from "viem";
import { DeployFixture } from "./protocol.test";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

export const doControllerTests = async (deploy: DeployFixture) => {
  describe("Controller Test", function () {
    it("should be initialized with correct configuration", async function () {
      const { governance, strategist, timelock, devfund, treasury, controller, vaultAsset, vault, strategy } =
        await loadFixture(deploy);

      expect(await controller.read.vaults([vaultAsset.address])).to.equal(getAddress(vault.address));
      expect(await controller.read.strategies([vaultAsset.address])).to.equal(getAddress(strategy.address));
      expect(await controller.read.approvedStrategies([vaultAsset.address, strategy.address])).to.be.true;

      expect(await controller.read.governance()).to.equal(getAddress(governance.account.address));
      expect(await controller.read.strategist()).to.equal(getAddress(strategist.account.address));
      expect(await controller.read.timelock()).to.equal(getAddress(timelock.account.address));
      expect(await controller.read.devfund()).to.equal(getAddress(devfund.account.address));
      expect(await controller.read.treasury()).to.equal(getAddress(treasury.account.address));
    });

    it("should allow governance to set new addresses", async function () {
      const { governance, user, controller } = await loadFixture(deploy);

      // Set new devfund
      await controller.write.setDevFund([user.account.address], {
        account: governance.account,
      });
      expect(await controller.read.devfund()).to.equal(getAddress(user.account.address));

      // Set new treasury
      await controller.write.setTreasury([user.account.address], {
        account: governance.account,
      });
      expect(await controller.read.treasury()).to.equal(getAddress(user.account.address));

      // Set new strategist
      await controller.write.setStrategist([user.account.address], {
        account: governance.account,
      });
      expect(await controller.read.strategist()).to.equal(getAddress(user.account.address));

      // Set new governance
      await controller.write.setGovernance([user.account.address], {
        account: governance.account,
      });
      expect(await controller.read.governance()).to.equal(getAddress(user.account.address));
    });

    it("should allow timelock to set new timelock", async function () {
      const { timelock, user, controller } = await loadFixture(deploy);

      await controller.write.setTimelock([user.account.address], {
        account: timelock.account,
      });
      expect(await controller.read.timelock()).to.equal(getAddress(user.account.address));
    });

    it("should fail when unauthorized users try to set addresses", async function () {
      const { user, controller } = await loadFixture(deploy);

      // Try to set addresses from unauthorized account
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

    it("should handle strategy approval and revocation correctly", async function () {
      const { governance, timelock, vaultAsset, user, controller, strategy } = await loadFixture(deploy);

      expect(await controller.read.approvedStrategies([vaultAsset.address, strategy.address])).to.be.true;

      const mockStrategy = user.account.address; // Using user address as mock strategy
      // Approve strategy
      await controller.write.approveStrategy([vaultAsset.address, mockStrategy], {
        account: timelock.account,
      });
      expect(await controller.read.approvedStrategies([vaultAsset.address, mockStrategy])).to.be.true;
      // Revoke strategy
      await controller.write.revokeStrategy([vaultAsset.address, mockStrategy], {
        account: governance.account,
      });
      expect(await controller.read.approvedStrategies([vaultAsset.address, mockStrategy])).to.be.false;
    });

    it("should not revoke active strategy", async function () {
      const { governance, vaultAsset, controller, strategy } = await loadFixture(deploy);
      expect(await controller.read.approvedStrategies([vaultAsset.address, strategy.address])).to.be.true;
      await expect(
        controller.write.revokeStrategy([vaultAsset.address, strategy.address], {
          account: governance.account,
        })
      ).to.be.revertedWith("cannot revoke active strategy");
      expect(await controller.read.approvedStrategies([vaultAsset.address, strategy.address])).to.be.true;
    });

    // it("should handle set new strategy and transfer all strategy balance to vault", async function () {
    //   const { governance, timelock, vaultAsset, user, controller, strategy, vault } = await loadFixture(deploy);
    //   const oldStrategyBalance = await vaultAsset.read.balanceOf([strategy.address]);
    //   const mockStrategy = user.account.address; // Using user address as mock strategy
    //   const newStrategyBalanceBefore = await vaultAsset.read.balanceOf([mockStrategy]);

    //   // Approve new strategy
    //   await controller.write.approveStrategy([vaultAsset.address, mockStrategy], {
    //     account: timelock.account,
    //   });
    //   expect(await controller.read.approvedStrategies([vaultAsset.address, mockStrategy])).to.be.true;
    //   // vault balance should be 0
    //   expect(await vaultAsset.read.balanceOf([vault.address])).to.be.eq(0n);
    //   await controller.write.setStrategy([vaultAsset.address, mockStrategy]);
    //   // Revoke old strategy
    //   await controller.write.revokeStrategy([vaultAsset.address, strategy.address], {
    //     account: governance.account,
    //   });
    //   expect(await controller.read.approvedStrategies([vaultAsset.address, strategy.address])).to.be.false;

    //   // old strategy should not have any balance while the vault has the old strategies whole balance
    //   expect(await vaultAsset.read.balanceOf([strategy.address])).to.be.eq(0n);
    //   expect(await vaultAsset.read.balanceOf([vault.address])).to.be.eq(oldStrategyBalance);
    // });

    it("should allow strategist or governance to set vault", async function () {
      const { governance, vaultAsset, user, controller, vault } = await loadFixture(deploy);

      const mockVault = user.account.address; // Using user address as mock vault

      // Should fail when trying to set vault again
      await expect(
        controller.write.setVault([vaultAsset.address, mockVault], {
          account: governance.account,
        })
      ).to.be.rejectedWith("vault already set");
    });
  });
};
