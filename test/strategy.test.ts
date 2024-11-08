import hre from "hardhat";
import { expect } from "chai";
import { increase } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { encodeFunctionData, getAddress, maxUint256, parseEventLogs, zeroAddress } from "viem";
import { DeployFixture } from "./protocol.test";
import { depositAndEarnInVault } from "../utils/test";

export const doStrategyTests = async (deploy: DeployFixture) => {
  describe("Strategy Tests", function () {
    describe("Strategy Configuration", function () {
      // Verifies that the strategy contract is initialized with the correct
      // addresses for core protocol components
      it("should initialize with correct parameters", async function () {
        const { governance, strategist, timelock, controller, vaultAsset, strategy } = await loadFixture(deploy);

        expect(await strategy.read.want()).to.equal(getAddress(vaultAsset.address));
        expect(await strategy.read.governance()).to.equal(getAddress(governance.account.address));
        expect(await strategy.read.strategist()).to.equal(getAddress(strategist.account.address));
        expect(await strategy.read.controller()).to.equal(getAddress(controller.address));
        expect(await strategy.read.timelock()).to.equal(getAddress(timelock.account.address));
      });

      // Ensures the strategy contract properly validates addresses during deployment
      // to prevent initialization with zero addresses
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
      // Tests the governance transfer mechanism, ensuring only current governance
      // can transfer control to a new address
      it("should allow governance to set new governance", async function () {
        const { governance, user, strategy: strategy } = await loadFixture(deploy);

        await strategy.write.setGovernance([user.account.address], {
          account: governance.account,
        });

        expect(await strategy.read.governance()).to.equal(getAddress(user.account.address));
      });

      // Validates that non-governance addresses cannot modify governance settings
      it("should prevent non-governance from setting new governance", async function () {
        const { user, strategy: strategy } = await loadFixture(deploy);

        await expect(
          strategy.write.setGovernance([user.account.address], {
            account: user.account,
          })
        ).to.be.rejectedWith("Only Governance");
      });

      // Tests timelock transfer mechanism, ensuring only current timelock
      // can transfer control to a new address
      it("should allow timelock to set new timelock", async function () {
        const { timelock, user, strategy: strategy } = await loadFixture(deploy);

        await strategy.write.setTimelock([user.account.address], {
          account: timelock.account,
        });

        expect(await strategy.read.timelock()).to.equal(getAddress(user.account.address));
      });

      // Validates that non-timelock addresses cannot modify timelock settings
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
      // Tests the ability to add authorized harvesters who can call the harvest function
      it("should allow governance to whitelist harvester", async function () {
        const { governance, user, strategy: strategy } = await loadFixture(deploy);

        await strategy.write.whitelistHarvester([user.account.address], {
          account: governance.account,
        });

        expect(await strategy.read.harvesters([user.account.address])).to.be.true;
      });

      // Tests the ability to remove previously authorized harvesters
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
      // Tests the ability to modify performance fee rates that go to treasury
      it("should allow timelock to set performance fees", async function () {
        const { timelock, strategy: strategy } = await loadFixture(deploy);

        const newFee = 2000n; // 20%
        await strategy.write.setPerformanceTreasuryFee([newFee], {
          account: timelock.account,
        });

        expect(await strategy.read.performanceTreasuryFee()).to.equal(newFee);
      });

      // Validates that only timelock can modify fee settings
      it("should prevent non-timelock from setting fees", async function () {
        const { user, strategy: strategy } = await loadFixture(deploy);

        await expect(
          strategy.write.setPerformanceTreasuryFee([2000n], {
            account: user.account,
          })
        ).to.be.rejectedWith("Only Timelock");
      });

      // Tests the ability to set both treasury and dev withdrawal fee rates
      it("should allow timelock to set withdrawal fees", async function () {
        const { timelock, strategy } = await loadFixture(deploy);

        const newTreasuryFee = 1000n; // 1%
        const newDevFee = 500n; // 0.5%

        await strategy.write.setWithdrawalTreasuryFee([newTreasuryFee], {
          account: timelock.account,
        });
        await strategy.write.setWithdrawalDevFundFee([newDevFee], {
          account: timelock.account,
        });

        expect(await strategy.read.withdrawalTreasuryFee()).to.equal(newTreasuryFee);
        expect(await strategy.read.withdrawalDevFundFee()).to.equal(newDevFee);
      });

      // Tests the ability to modify performance fee rates that go to dev fund
      it("should allow timelock to set performance dev fee", async function () {
        const { timelock, strategy } = await loadFixture(deploy);

        const newFee = 1000n; // 10%
        await strategy.write.setPerformanceDevFee([newFee], {
          account: timelock.account,
        });

        expect(await strategy.read.performanceDevFee()).to.equal(newFee);
      });
    });

    describe("Controller Management", function () {
      // Tests the ability to update the controller address
      it("should allow timelock to set new controller", async function () {
        const { timelock, user, strategy } = await loadFixture(deploy);

        await strategy.write.setController([user.account.address], {
          account: timelock.account,
        });

        expect(await strategy.read.controller()).to.equal(getAddress(user.account.address));
      });

      // Validates that only timelock can modify controller settings
      it("should prevent non-timelock from setting controller", async function () {
        const { user, strategy } = await loadFixture(deploy);

        await expect(
          strategy.write.setController([user.account.address], {
            account: user.account,
          })
        ).to.be.rejectedWith("Only Timelock");
      });
    });

    describe("Strategist Management", function () {
      // Tests the ability to update the strategist address
      it("should allow governance to set new strategist", async function () {
        const { governance, user, strategy } = await loadFixture(deploy);

        await strategy.write.setStrategist([user.account.address], {
          account: governance.account,
        });

        expect(await strategy.read.strategist()).to.equal(getAddress(user.account.address));
      });

      // Validates that only governance can modify strategist settings
      it("should prevent non-governance from setting strategist", async function () {
        const { user, strategy } = await loadFixture(deploy);

        await expect(
          strategy.write.setStrategist([user.account.address], {
            account: user.account,
          })
        ).to.be.rejectedWith("Only Governance");
      });
    });

    describe("Emergency Functions", function () {
      // Tests the emergency execution functionality that allows timelock to
      // perform recovery operations in case of critical issues
      it("should allow timelock to execute emergency functions", async function () {
        const { timelock, strategy, vaultAsset, user } = await loadFixture(deploy);

        const mockExecute = await hre.viem.deployContract("MockStrategyExecute");
        const balance = await vaultAsset.read.balanceOf([user.account.address]);

        await vaultAsset.write.transfer([strategy.address, balance], {
          account: user.account,
        });

        const data = encodeFunctionData({
          abi: [
            {
              inputs: [
                {
                  internalType: "address",
                  name: "_token",
                  type: "address",
                },
                {
                  internalType: "uint256",
                  name: "_amount",
                  type: "uint256",
                },
              ],
              name: "write",
              outputs: [],
              stateMutability: "nonpayable",
              type: "function",
            },
          ],
          functionName: "write",
          args: [vaultAsset.address, balance],
        });

        // timelock vaultAsset balance should be 0
        expect(await vaultAsset.read.balanceOf([timelock.account.address])).to.equal(0n);

        await strategy.write.execute([mockExecute.address, data], {
          account: timelock.account,
        });

        expect(await vaultAsset.read.balanceOf([timelock.account.address])).to.equal(balance);
      });

      // Validates that only timelock can execute emergency functions
      it("should prevent non-timelock from executing emergency functions", async function () {
        const { user, strategy, vaultAsset } = await loadFixture(deploy);

        await expect(
          strategy.write.execute([vaultAsset.address, "0x"], {
            account: user.account,
          })
        ).to.be.rejectedWith("Only Timelock");
      });

      // Ensures emergency functions cannot be executed with invalid targets
      it("should prevent executing emergency functions with zero target", async function () {
        const { timelock, strategy } = await loadFixture(deploy);

        await expect(
          strategy.write.execute([zeroAddress, "0x"], {
            account: timelock.account,
          })
        ).to.be.rejectedWith("!target");
      });
    });

    describe("Withdrawal Functions", function () {
      // Validates that the want token cannot be withdrawn through the generic withdraw function
      it("should prevent withdrawing want token through generic withdraw", async function () {
        const { timelock, user, strategy, vaultAsset, vault } = await loadFixture(deploy);

        await depositAndEarnInVault(vault, vaultAsset, user);

        await strategy.write.setController([user.account.address], {
          account: timelock.account,
        });

        await expect(
          strategy.write.withdraw([vaultAsset.address], {
            account: user.account,
          })
        ).to.be.rejectedWith("want");
      });

      // Ensures only the controller can initiate withdrawals
      it("should prevent non-controller from withdrawing", async function () {
        const { user, strategy, vaultAsset, vault } = await loadFixture(deploy);

        await expect(
          strategy.write.withdraw([vaultAsset.address], {
            account: user.account,
          })
        ).to.be.rejectedWith("Only Controller");

        await expect(
          strategy.write.withdraw([1n], {
            account: user.account,
          })
        ).to.be.rejectedWith("Only Controller");

        await expect(
          strategy.write.withdrawForSwap([1n], {
            account: user.account,
          })
        ).to.be.rejectedWith("Only Controller");
      });

      // Tests that users receive the correct amount when withdrawing
      it("should withdraw correct amount", async function () {
        const { user, vaultAsset, vault } = await loadFixture(deploy);

        const depositAmount = await vaultAsset.read.balanceOf([user.account.address]);
        await depositAndEarnInVault(vault, vaultAsset, user);
        await vault.write.withdrawAll({
          account: user.account,
        });
        expect(await vaultAsset.read.balanceOf([user.account.address])).to.eq(depositAmount, "invalid user balance");
      });
    });

    describe("Balance Tracking", function () {
      // Tests the accuracy of balance reporting functions for both
      // staked and unstaked assets
      it("should correctly report balances", async function () {
        const { vaultAsset, strategy, stakable, vault, user } = await loadFixture(deploy);

        expect(await strategy.read.balanceOfPool()).to.equal(0n, "balanceOfPool should be 0");

        const min = await vault.read.min();
        const max = await vault.read.max();
        const amount = await vaultAsset.read.balanceOf([user.account.address]);
        const available = (amount * min) / max;
        await depositAndEarnInVault(vault, vaultAsset, user);

        if (stakable) {
          expect(await strategy.read.balanceOfPool()).to.equal(available, "invalid balanceOfPool");
          expect(await vaultAsset.read.balanceOf([vault.address])).to.equal(amount - available, "invalid balanceOf");
        } else {
          expect(await strategy.read.balanceOfPool()).to.equal(0n, "invalid balanceOfPool");
          // if token is not staked, the balanceOf and balanceOfWant should be same
          expect(await strategy.read.balanceOf()).to.equal(await strategy.read.balanceOfWant(), "invalid balanceOf");
          expect(await strategy.read.balanceOfWant()).to.equal(available, "invalid balanceOfWant");
        }
      });
    });

    describe("Fee Calculations and Distributions", function () {
      // Validates the correct calculation and distribution of withdrawal fees
      // to treasury and dev fund
      it("should correctly calculate and distribute withdrawal fees", async function () {
        const { timelock, user, strategy, vaultAsset, vault, controller } = await loadFixture(deploy);

        // Set withdrawal fees
        const withdrawalTreasuryFee = 1000n; // 1%
        const withdrawalDevFee = 1000n; // 0.5%

        await strategy.write.setWithdrawalTreasuryFee([withdrawalTreasuryFee], {
          account: timelock.account,
        });
        await strategy.write.setWithdrawalDevFundFee([withdrawalDevFee], {
          account: timelock.account,
        });
        // Get initial balances
        const treasuryInitial = await vaultAsset.read.balanceOf([await controller.read.treasury()]);
        const devFundInitial = await vaultAsset.read.balanceOf([await controller.read.devfund()]);

        // Deposit funds
        const depositAmount = await vaultAsset.read.balanceOf([user.account.address]);
        await depositAndEarnInVault(vault, vaultAsset, user);

        const available = await vaultAsset.read.balanceOf([vault.address]);

        // Withdraw all funds
        await vault.write.withdrawAll({
          account: user.account,
        });

        const feeableAmount = depositAmount - available;

        // Calculate expected fees
        const expectedTreasuryFee = (feeableAmount * withdrawalTreasuryFee) / 100000n;
        const expectedDevFee = (feeableAmount * withdrawalDevFee) / 100000n;
        const expectedUserAmount = depositAmount - expectedTreasuryFee - expectedDevFee;

        // Verify final balances
        const treasuryFinal = await vaultAsset.read.balanceOf([await controller.read.treasury()]);
        const devFundFinal = await vaultAsset.read.balanceOf([await controller.read.devfund()]);
        const userFinal = await vaultAsset.read.balanceOf([user.account.address]);

        expect(treasuryFinal - treasuryInitial).to.equal(expectedTreasuryFee, "Invalid treasury fee");
        expect(devFundFinal - devFundInitial).to.equal(expectedDevFee, "Invalid dev fee");
        expect(userFinal).to.equal(expectedUserAmount, "Invalid user received amount");
      });

      // Tests the profit generation mechanism and proper fee distribution
      // from harvested profits
      it("should make profit for user and correctly calculate and distribute performance fees", async function () {
        const { timelock, user, strategy, vaultAsset, vault, controller } = await loadFixture(deploy);
        // Set performance fees
        const performanceTreasuryFee = 1000n; // 10%
        const performanceDevFee = 500n; // 5%
        await strategy.write.setPerformanceTreasuryFee([performanceTreasuryFee], {
          account: timelock.account,
        });
        await strategy.write.setPerformanceDevFee([performanceDevFee], {
          account: timelock.account,
        });

        // deposit into vault
        const depositAmount = await vaultAsset.read.balanceOf([user.account.address]);
        await vaultAsset.write.approve([vault.address, maxUint256], { account: user.account });
        await vault.write.depositAll({ account: user.account });
        await vault.write.earn();

        // Get initial balances
        const treasuryInitial = await vaultAsset.read.balanceOf([await controller.read.treasury()]);
        const devFundInitial = await vaultAsset.read.balanceOf([await controller.read.devfund()]);

        // wait for some time to simulate profit
        await increase(10000);
        // Trigger harvest to distribute performance fees
        const tx = await strategy.write.harvest({
          account: user.account,
        });
        const receipt = await (await hre.viem.getPublicClient()).waitForTransactionReceipt({ hash: tx });
        const parseLogs = parseEventLogs({
          abi: [
            {
              anonymous: false,
              inputs: [
                {
                  indexed: false,
                  internalType: "uint256",
                  name: "timestamp",
                  type: "uint256",
                },
                {
                  indexed: false,
                  internalType: "uint256",
                  name: "amount",
                  type: "uint256",
                },
              ],
              name: "Harvest",
              type: "event",
            },
          ],
          logs: receipt.logs,
          eventName: "Harvest",
        })?.find((e) => e.eventName === "Harvest");
        const profit = (parseLogs?.args as any)?.amount ?? 0n;

        // Calculate expected fees
        const expectedTreasuryFee = (profit * performanceTreasuryFee) / 10000n;
        const expectedDevFee = (profit * performanceDevFee) / 10000n;
        // Verify final balances
        const treasuryFinal = await vaultAsset.read.balanceOf([await controller.read.treasury()]);
        const devFundFinal = await vaultAsset.read.balanceOf([await controller.read.devfund()]);

        // Withdraw all funds
        await vault.write.withdrawAll({
          account: user.account,
        });

        const amountAfterWithdraw = await vaultAsset.read.balanceOf([user.account.address]);

        expect(amountAfterWithdraw).to.equal(
          depositAmount + profit - expectedTreasuryFee - expectedDevFee,
          "Invalid user amount"
        );
        expect(treasuryFinal - treasuryInitial).to.equal(expectedTreasuryFee, "Invalid treasury performance fee");
        expect(devFundFinal - devFundInitial).to.equal(expectedDevFee, "Invalid dev performance fee");
      });

      // Validates that the system works correctly when all fees are set to zero
      it("should handle zero fees correctly", async function () {
        const { timelock, user, strategy, vaultAsset, vault } = await loadFixture(deploy);

        // Set all fees to zero
        await strategy.write.setWithdrawalTreasuryFee([0n], {
          account: timelock.account,
        });
        await strategy.write.setWithdrawalDevFundFee([0n], {
          account: timelock.account,
        });
        await strategy.write.setPerformanceTreasuryFee([0n], {
          account: timelock.account,
        });
        await strategy.write.setPerformanceDevFee([0n], {
          account: timelock.account,
        });

        // Deposit and withdraw to verify no fees are taken
        const depositAmount = await vaultAsset.read.balanceOf([user.account.address]);
        await depositAndEarnInVault(vault, vaultAsset, user);

        await vault.write.withdrawAll({
          account: user.account,
        });

        expect(await vaultAsset.read.balanceOf([user.account.address])).to.equal(
          depositAmount,
          "User should receive full amount with zero fees"
        );
      });
    });
  });
};
