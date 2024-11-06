import hre from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress, zeroAddress } from "viem";
import { DeployFixture } from "./protocol.test";

export const doStrategyTests = async (deploy: DeployFixture) => {
  describe("Strategy Tests", function () {
    describe("Strategy Configuration", function () {
      it("should initialize with correct parameters", async function () {
        const { governance, strategist, timelock, controller, vaultAsset, strategy } = await loadFixture(deploy);

        expect(await strategy.read.want()).to.equal(getAddress(vaultAsset.address));
        expect(await strategy.read.governance()).to.equal(getAddress(governance.account.address));
        expect(await strategy.read.strategist()).to.equal(getAddress(strategist.account.address));
        expect(await strategy.read.controller()).to.equal(getAddress(controller.address));
        expect(await strategy.read.timelock()).to.equal(getAddress(timelock.account.address));
      });

      it("should fail initialization with zero addresses", async function () {
        const { vaultAsset, governance, strategist, timelock, controller } = await loadFixture(deploy);

        await expect(
          hre.viem.deployContract("GammaStrategy", [
            zeroAddress,
            governance.account.address,
            strategist.account.address,
            controller.address,
            timelock.account.address,
          ])
        ).to.be.rejectedWith("One or more addresses are invalid");

        await expect(
          hre.viem.deployContract("GammaStrategy", [
            vaultAsset.address,
            governance.account.address,
            strategist.account.address,
            controller.address,
            zeroAddress,
          ])
        ).to.be.rejectedWith("One or more addresses are invalid");
      });
    });

    describe("Access Control", function () {
      it("should allow governance to set new governance", async function () {
        const { governance, user, strategy: strategy } = await loadFixture(deploy);

        await strategy.write.setGovernance([user.account.address], {
          account: governance.account,
        });

        expect(await strategy.read.governance()).to.equal(getAddress(user.account.address));
      });

      it("should prevent non-governance from setting new governance", async function () {
        const { user, strategy: strategy } = await loadFixture(deploy);

        await expect(
          strategy.write.setGovernance([user.account.address], {
            account: user.account,
          })
        ).to.be.rejectedWith("Only Governance");
      });

      it("should allow timelock to set new timelock", async function () {
        const { timelock, user, strategy: strategy } = await loadFixture(deploy);

        await strategy.write.setTimelock([user.account.address], {
          account: timelock.account,
        });

        expect(await strategy.read.timelock()).to.equal(getAddress(user.account.address));
      });

      it("should prevent non-timelock from setting new timelock", async function () {
        const { user, strategy: strategy } = await loadFixture(deploy);

        await expect(
          strategy.write.setTimelock([user.account.address], {
            account: user.account,
          })
        ).to.be.rejectedWith("Only Timelock");
      });
    });

    describe("Harvester Management", function () {
      it("should allow governance to whitelist harvester", async function () {
        const { governance, user, strategy: strategy } = await loadFixture(deploy);

        await strategy.write.whitelistHarvester([user.account.address], {
          account: governance.account,
        });

        expect(await strategy.read.harvesters([user.account.address])).to.be.true;
      });

      it("should allow governance to revoke harvester", async function () {
        const { governance, user, strategy: strategy } = await loadFixture(deploy);

        await strategy.write.whitelistHarvester([user.account.address], {
          account: governance.account,
        });
        await strategy.write.revokeHarvester([user.account.address], {
          account: governance.account,
        });

        expect(await strategy.read.harvesters([user.account.address])).to.be.false;
      });
    });

    describe("Fee Management", function () {
      it("should allow timelock to set performance fees", async function () {
        const { timelock, strategy: strategy } = await loadFixture(deploy);

        const newFee = 2000n; // 20%
        await strategy.write.setPerformanceTreasuryFee([newFee], {
          account: timelock.account,
        });

        expect(await strategy.read.performanceTreasuryFee()).to.equal(newFee);
      });

      it("should prevent non-timelock from setting fees", async function () {
        const { user, strategy: strategy } = await loadFixture(deploy);

        await expect(
          strategy.write.setPerformanceTreasuryFee([2000n], {
            account: user.account,
          })
        ).to.be.rejectedWith("Only Timelock");
      });
    });

    // TODO: fix this test
    // describe("Balance Tracking", function () {
    //   it("should correctly report balances", async function () {
    //     const { vaultAsset, strategy, stakable } = await loadFixture(deploy);

    //     const amount = 1000000n;

    //     await vaultAsset.write.mint([strategy.address, amount]);

    //     expect(await strategy.read.balanceOfWant()).to.equal(amount, "invalid balanceOfWant");

    //     if (stakable) {
    //       expect(await strategy.read.balanceOfPool()).to.equal(amount, "invalid balanceOfPool");
    //     } else {
    //       // if token is not staked, the balanceOf and balanceOfWant should be same
    //       expect(await strategy.read.balanceOf()).to.equal(await strategy.read.balanceOfWant(), "invalid balanceOf");
    //     }
    //   });
    // });
    // TODO: test stakable strategies
  });
};
