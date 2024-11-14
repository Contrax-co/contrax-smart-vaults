import hre from "hardhat";
import { expect } from "chai";
import { getAddress, zeroAddress, parseEther, parseUnits } from "viem";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { DeployFixture } from "./protocol.test";

export const doZapperTests = (deploy: DeployFixture) => {
  describe("Zapper Tests", async function () {
    describe("Initialization", function () {
      // Verify the zapper contract is initialized with the correct configuration
      it("should initialize with correct values", async function () {
        const { zapper, wrappedNative, usdc, swapRouter, vault } = await loadFixture(deploy);

        expect(await zapper.read.wrappedNative()).to.equal(getAddress(wrappedNative.address));
        expect(await zapper.read.usdcToken()).to.equal(getAddress(usdc.address));
        expect(await zapper.read.swapRouter()).to.equal(getAddress(swapRouter.address));
        expect(await zapper.read.whitelistedVaults([vault.address])).to.be.true;
        expect(await zapper.read.minimumAmount()).to.equal(1000n);
      });
    });

    describe("Governance Functions", function () {
      // Test governance's ability to add new vaults to the whitelist
      it("should allow governance to whitelist vault", async function () {
        const { zapper, governance, vaultAsset, timelock, controller } = await loadFixture(deploy);

        const newVault = await hre.viem.deployContract("Vault", [
          vaultAsset.address,
          governance.account.address,
          timelock.account.address,
          controller.address,
        ]);

        await expect(
          zapper.write.setWhitelistVault([newVault.address, true], {
            account: governance.account,
          })
        )
          .to.emit(zapper, "WhitelistVault")
          .withArgs(getAddress(newVault.address), true);

        expect(await zapper.read.whitelistedVaults([newVault.address])).to.be.true;
      });

      // Test governance's ability to update the swap router address
      it("should allow governance to update swap router", async function () {
        const { zapper, governance, wrappedNative } = await loadFixture(deploy);

        const newSwapRouter = await hre.viem.deployContract("MockSwapRouter", [wrappedNative.address]);

        await expect(
          zapper.write.setSwapRouter([newSwapRouter.address], {
            account: governance.account,
          })
        )
          .to.emit(zapper, "SetSwapRouter")
          .withArgs(getAddress(newSwapRouter.address), await zapper.read.swapRouter());

        expect(await zapper.read.swapRouter()).to.equal(getAddress(newSwapRouter.address));
      });

      // Verify access control - only governance can whitelist vaults
      it("should prevent non-governance from whitelisting vault", async function () {
        const { zapper, vaultAsset, governance, timelock, controller, user } = await loadFixture(deploy);

        const newVault = await hre.viem.deployContract("Vault", [
          vaultAsset.address,
          governance.account.address,
          timelock.account.address,
          controller.address,
        ]);

        await expect(
          zapper.write.setWhitelistVault([newVault.address, true], {
            account: user.account,
          })
        ).to.be.rejectedWith("Caller is not the governance");
      });
    });

    describe("Zap Operations", function () {

      it("User wallet contains usdc balance", async function () {
        const { usdc, user } = await loadFixture(deploy);
        let usdcBalance = await usdc.read.balanceOf([user.account.address]);
        console.log("usdcBalance", usdcBalance);
        expect(usdcBalance).to.be.gt(0);
      });

      // Test the basic ETH zap-in functionality
      // Users should be able to deposit ETH and receive vault shares
      it("should successfully zap in ETH", async function () {
        const { zapper, vault, user } = await loadFixture(deploy);

        const zapAmount = parseEther("1");
        const minAmount = 0n;

        await expect(
          zapper.write.zapInETH([vault.address, minAmount, zeroAddress], {
            value: zapAmount,
            account: user.account,
          })
        ).to.emit(zapper, "ZapIn");
      });

      // Verify minimum amount check for ETH deposits
      // Prevents dust attacks and ensures meaningful transactions
      it("should reject ETH zap with insufficient amount", async function () {
        const { zapper, vault, user } = await loadFixture(deploy);

        const zapAmount = 100n; // Less than minimumAmount
        const minAmount = 0n;

        await expect(
          zapper.write.zapInETH([vault.address, minAmount, zeroAddress], {
            value: zapAmount,
            account: user.account,
          })
        ).to.be.rejectedWith("Insignificant input amount");
      });

      // Verify vault whitelist protection
      // Users should not be able to zap into non-whitelisted vaults
      it("should reject zap to non-whitelisted vault", async function () {
        const { zapper, vaultAsset, governance, timelock, controller, user } = await loadFixture(deploy);

        const nonWhitelistedVault = await hre.viem.deployContract("Vault", [
          vaultAsset.address,
          governance.account.address,
          timelock.account.address,
          controller.address,
        ]);
        const zapAmount = parseEther("1");
        const minAmount = 0n;

        await expect(
          zapper.write.zapInETH([nonWhitelistedVault.address, minAmount, zeroAddress], {
            value: zapAmount,
            account: user.account,
          })
        ).to.be.rejectedWith("Vault is not whitelisted");
      });
    });

    describe("Zap In Operations", function () {
      // Test the token zap-in functionality
      // Users should be able to deposit tokens (e.g., USDC) and receive vault shares
      it("should successfully zap in tokens", async function () {
        const { zapper, vault, usdc, user, usdcDecimals } = await loadFixture(deploy);

        const zapAmount = parseUnits("1000", usdcDecimals); // Use dynamic decimals

        //  approve tokens
        await usdc.write.approve([zapper.address, zapAmount], {
          account: user.account,
        });

        await expect(
          zapper.write.zapIn([vault.address, 0n, usdc.address, zapAmount], {
            account: user.account,
          })
        ).to.emit(zapper, "ZapIn");
      });

      // Verify token approval requirement
      // Users must approve tokens before zapping in
      it("should reject token zap without approval", async function () {
        const { zapper, vault, usdc, user, usdcDecimals } = await loadFixture(deploy);

        const zapAmount = parseUnits("1000", usdcDecimals); // Use dynamic decimals

        await expect(
          zapper.write.zapIn([vault.address, 0n, usdc.address, zapAmount], {
            account: user.account,
          })
        ).to.be.rejectedWith("Input token is not approved");
      });
    });

    describe("Zap Out Operations", function () {
      // Test ETH withdrawal functionality
      // Users should be able to burn vault shares and receive ETH
      it("should successfully zap out to ETH", async function () {
        const { zapper, vault, user } = await loadFixture(deploy);

        // First zap in some ETH to get vault shares
        const zapInAmount = parseEther("1");
        await zapper.write.zapInETH([vault.address, 0n, zeroAddress], {
          value: zapInAmount,
          account: user.account,
        });

        // Get user's vault balance
        const vaultBalance = await vault.read.balanceOf([user.account.address]);

        // Approve vault shares to zapper
        await vault.write.approve([zapper.address, vaultBalance], {
          account: user.account,
        });

        // Zap out to ETH
        await expect(
          zapper.write.zapOutAndSwapEth([vault.address, vaultBalance, 0n], {
            account: user.account,
          })
        ).to.emit(zapper, "ZapOut");
      });

      // Test token withdrawal functionality
      // Users should be able to burn vault shares and receive tokens (e.g., USDC)
      it("should successfully zap out to USDC", async function () {
        const { zapper, vault, usdc, user, usdcDecimals } = await loadFixture(deploy);

        // First zap in some ETH to get vault shares
        const zapInAmount = parseEther("1");
        await zapper.write.zapInETH([vault.address, 0n, zeroAddress], {
          value: zapInAmount,
          account: user.account,
        });

        // Get user's vault balance
        const vaultBalance = await vault.read.balanceOf([user.account.address]);

        // Approve vault shares to zapper
        await vault.write.approve([zapper.address, vaultBalance], {
          account: user.account,
        });

        // Zap out to USDC
        await expect(
          zapper.write.zapOutAndSwap([vault.address, vaultBalance, usdc.address, 0n], {
            account: user.account,
          })
        ).to.emit(zapper, "ZapOut");
      });

      // Verify vault share approval requirement for withdrawals
      it("should reject zap out without approval", async function () {
        const { zapper, vault, user } = await loadFixture(deploy);

        // First zap in some ETH to get vault shares
        const zapInAmount = parseEther("1");
        await zapper.write.zapInETH([vault.address, 0n, zeroAddress], {
          value: zapInAmount,
          account: user.account,
        });

        // Get user's vault balance
        const vaultBalance = await vault.read.balanceOf([user.account.address]);

        // Try to zap out without approval
        await expect(
          zapper.write.zapOutAndSwapEth([vault.address, vaultBalance, 0n], {
            account: user.account,
          })
        ).to.be.rejected;
      });

      // Verify vault whitelist protection for withdrawals
      it("should reject zap out from non-whitelisted vault", async function () {
        const { zapper, vaultAsset, governance, timelock, controller, user } = await loadFixture(deploy);

        const nonWhitelistedVault = await hre.viem.deployContract("Vault", [
          vaultAsset.address,
          governance.account.address,
          timelock.account.address,
          controller.address,
        ]);

        await expect(
          zapper.write.zapOutAndSwapEth([nonWhitelistedVault.address, parseEther("1"), 0n], {
            account: user.account,
          })
        ).to.be.rejectedWith("Vault is not whitelisted");
      });

      // Test minimum output amount protection
      // Ensures users do not receive less than their specified minimum amount
      it("should respect minimum output amount", async function () {
        const { zapper, vault, user } = await loadFixture(deploy);

        // First zap in some ETH to get vault shares
        const zapInAmount = parseEther("1");
        await zapper.write.zapInETH([vault.address, 0n, zeroAddress], {
          value: zapInAmount,
          account: user.account,
        });

        // Get user's vault balance
        const vaultBalance = await vault.read.balanceOf([user.account.address]);

        // Approve vault shares to zapper
        await vault.write.approve([zapper.address, vaultBalance], {
          account: user.account,
        });

        // Try to zap out with unreasonably high minimum output amount
        await expect(
          zapper.write.zapOutAndSwapEth([vault.address, vaultBalance, parseEther("1000")], {
            account: user.account,
          })
        ).to.be.rejectedWith("zapOut: Insufficient output amount");
      });
    });

    describe("Slippage Protection", function () {
      // Test slippage protection for ETH deposits
      // Users should be protected from receiving fewer shares than expected
      it("should respect minimum shares on zap in with ETH", async function () {
        const { zapper, vault, user } = await loadFixture(deploy);

        const zapAmount = parseEther("1");
        const minShares = parseEther("1.1");

        await expect(
          zapper.write.zapInETH([vault.address, minShares, zeroAddress], {
            value: zapAmount,
            account: user.account,
          })
        ).to.be.rejectedWith("zapIn: Insufficient output vault shares");
      });

      // Test slippage protection for token deposits
      it("should respect minimum shares on zap in with tokens", async function () {
        const { zapper, vault, usdc, user, usdcDecimals } = await loadFixture(deploy);

        const zapAmount = parseEther("1000");
        const minShares = parseEther("1001");

        await usdc.write.approve([zapper.address, zapAmount], {
          account: user.account,
        });

        await expect(
          zapper.write.zapIn([vault.address, minShares, usdc.address, zapAmount], {
            account: user.account,
          })
        ).to.be.rejectedWith("zapIn: Insufficient output vault shares");
      });

      // Test slippage protection for ETH withdrawals
      it("should respect minimum output shares on zap out to ETH", async function () {
        const { zapper, vault, user } = await loadFixture(deploy);

        // First zap in some ETH
        const zapInAmount = parseEther("1");
        await zapper.write.zapInETH([vault.address, 0n, zeroAddress], {
          value: zapInAmount,
          account: user.account,
        });

        const vaultBalance = await vault.read.balanceOf([user.account.address]);
        await vault.write.approve([zapper.address, vaultBalance], {
          account: user.account,
        });

        // Try to zap out with very high minimum output requirement
        const unreasonableMinOutput = parseEther("10"); // Much more than deposited
        await expect(
          zapper.write.zapOutAndSwapEth([vault.address, vaultBalance, unreasonableMinOutput], {
            account: user.account,
          })
        ).to.be.rejectedWith("zapOut: Insufficient output amount");
      });

      // Test slippage protection for token withdrawals
      it("should respect minimum output shares on zap out to USDC", async function () {
        const { zapper, vault, usdc, user, usdcDecimals } = await loadFixture(deploy);

        // First zap in some USDC
        const zapInAmount = parseUnits("1000", usdcDecimals); // Use dynamic decimals
        await usdc.write.approve([zapper.address, zapInAmount], {
          account: user.account,
        });
        await zapper.write.zapIn([vault.address, 0n, usdc.address, zapInAmount], {
          account: user.account,
        });

        const vaultBalance = await vault.read.balanceOf([user.account.address]);
        await vault.write.approve([zapper.address, vaultBalance], {
          account: user.account,
        });

        // Try to zap out with very high minimum USDC output requirement
        const unreasonableMinOutput = parseUnits("10000", usdcDecimals); // Use dynamic decimals
        await expect(
          zapper.write.zapOutAndSwap([vault.address, vaultBalance, usdc.address, unreasonableMinOutput], {
            account: user.account,
          })
        ).to.be.rejectedWith("zapOut: Insufficient output amount");
      });

      // Test successful execution with reasonable slippage settings for ETH
      it("should successfully execute with reasonable slippage tolerance with ETH", async function () {
        const { zapper, vault, user, maxSlippage: maxWithdrawSlippage } = await loadFixture(deploy);

        // Zap in with 1% minimum shares requirement
        const zapInAmount = parseEther("1");

        // Zap in should succeed with reasonable slippage
        await expect(
          zapper.write.zapInETH([vault.address, 0n, zeroAddress], {
            value: zapInAmount,
            account: user.account,
          })
        ).to.emit(zapper, "ZapIn");

        // Now test zap out with reasonable slippage
        const vaultBalance = await vault.read.balanceOf([user.account.address]);
        await vault.write.approve([zapper.address, vaultBalance], {
          account: user.account,
        });

        const minOutputAmount = (zapInAmount * (100n - maxWithdrawSlippage)) / 100n;
        await expect(
          zapper.write.zapOutAndSwapEth([vault.address, vaultBalance, minOutputAmount], {
            account: user.account,
          })
        ).to.emit(zapper, "ZapOut");
      });

      // Test successful execution with reasonable slippage settings for tokens
      it("should successfully execute with reasonable slippage tolerance with USDC", async function () {
        const { zapper, vault, usdc, user, maxSlippage: maxWithdrawSlippage } = await loadFixture(deploy);

        // Zap in with 1% minimum shares requirement
        const zapInAmount = parseEther("1");

        await usdc.write.approve([zapper.address, zapInAmount], {
          account: user.account,
        });

        // Zap in should succeed with reasonable slippage
        await expect(
          zapper.write.zapIn([vault.address, 0n, usdc.address, zapInAmount], {
            account: user.account,
          })
        ).to.emit(zapper, "ZapIn");

        // Now test zap out with reasonable slippage
        const vaultBalance = await vault.read.balanceOf([user.account.address]);
        await vault.write.approve([zapper.address, vaultBalance], {
          account: user.account,
        });

        const minOutputAmount = (zapInAmount * (100n - maxWithdrawSlippage)) / 100n;
        await expect(
          zapper.write.zapOutAndSwap([vault.address, vaultBalance, usdc.address, minOutputAmount], {
            account: user.account,
          })
        ).to.emit(zapper, "ZapOut");
      });
    });

    describe("Zap Out Amount Verification", function () {
      // Verify that ETH withdrawals return the expected amount within slippage bounds
      // Accounts for gas costs in the calculation
      it("should return expected amount within slippage on ETH zap out", async function () {
        const { zapper, vault, user, maxSlippage: maxWithdrawSlippage } = await loadFixture(deploy);
        const publicClient = await hre.viem.getPublicClient();

        // Initial zap in with ETH
        const zapInAmount = parseEther("1");
        await zapper.write.zapInETH([vault.address, 0n, zeroAddress], {
          value: zapInAmount,
          account: user.account,
        });

        // Get initial ETH balance
        const initialBalance = (await publicClient.getBalance({
          address: user.account.address,
        })) as bigint;

        // Get vault balance and approve
        const vaultBalance = await vault.read.balanceOf([user.account.address]);
        await vault.write.approve([zapper.address, vaultBalance], {
          account: user.account,
        });

        // Calculate minimum expected amount based on maxWithdrawSlippage
        const minOutputAmount = (zapInAmount * (100n - maxWithdrawSlippage)) / 100n;

        // Perform zap out
        const tx = await zapper.write.zapOutAndSwapEth([vault.address, vaultBalance, minOutputAmount], {
          account: user.account,
        });

        // Get final balance
        const finalBalance = (await publicClient.getBalance({
          address: user.account.address,
        })) as bigint;

        // Calculate actual received amount (accounting for gas costs)
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: tx,
        });
        const gasSpent = receipt.gasUsed * receipt.effectiveGasPrice;
        const actualReceived = finalBalance - initialBalance + gasSpent;

        // Verify received amount is within slippage bounds
        expect(actualReceived).to.be.gte(minOutputAmount);
        expect(actualReceived).to.be.lte(zapInAmount);
      });

      // Verify that token withdrawals return the expected amount within slippage bounds
      it("should return expected amount within slippage on USDC zap out", async function () {
        const { zapper, vault, usdc, user, maxSlippage: maxWithdrawSlippage, usdcDecimals } = await loadFixture(deploy);

        // Initial zap in with USDC
        const zapInAmount = parseUnits("1000", usdcDecimals); // Use dynamic decimals

        // Approve and zap in USDC
        await usdc.write.approve([zapper.address, zapInAmount], {
          account: user.account,
        });
        await zapper.write.zapIn([vault.address, 0n, usdc.address, zapInAmount], {
          account: user.account,
        });

        // Get initial USDC balance
        const initialUsdcBalance = await usdc.read.balanceOf([user.account.address]);

        // Get vault balance and approve
        const vaultBalance = await vault.read.balanceOf([user.account.address]);
        await vault.write.approve([zapper.address, vaultBalance], {
          account: user.account,
        });

        // Calculate minimum expected amount based on maxWithdrawSlippage
        const minOutputAmount = (zapInAmount * (100n - maxWithdrawSlippage)) / 100n;

        // Perform zap out
        await zapper.write.zapOutAndSwap([vault.address, vaultBalance, usdc.address, minOutputAmount], {
          account: user.account,
        });

        // Get final USDC balance
        const finalUsdcBalance = await usdc.read.balanceOf([user.account.address]);

        // Calculate actual received amount
        const actualReceived = finalUsdcBalance - initialUsdcBalance;

        // Verify received amount is within slippage bounds
        expect(actualReceived).to.be.gte(minOutputAmount);
        expect(actualReceived).to.be.lte(zapInAmount);
      });
    });
  });
};
