import { expect } from "chai";
import { getAddress, zeroAddress } from "viem";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { DexType } from "../utils/types";
import { DeployFixture } from "./protocol.test";

export const doSwapRouterTests = (deploy: DeployFixture) => {
  describe("SwapRouter Tests", function () {
    it("should initialize with correct router configurations", async function () {
      const { swapRouter, wrappedNative } = await loadFixture(deploy);

      // Verify wrapped native token address
      expect(await swapRouter.read.wrappedNative()).to.equal(getAddress(wrappedNative.address));

      // Verify Uniswap V2 router is set
      const uniV2Router = await swapRouter.read.v2Router([DexType.UNISWAP_V2]); // 0 = UNISWAP_V2
      expect(uniV2Router).to.not.equal(zeroAddress);

      // Verify Uniswap V3 router and factory are set
      const uniV3Router = await swapRouter.read.v3Router([DexType.UNISWAP_V3]); // 2 = UNISWAP_V3
      const uniV3Factory = await swapRouter.read.v3Factory([DexType.UNISWAP_V3]);
      expect(uniV3Router).to.not.equal(zeroAddress);
      expect(uniV3Factory).to.not.equal(zeroAddress);
    });

    it("should execute V2 swap with correct parameters", async function () {
      const { swapRouter, usdc: tokenA, wrappedNative: tokenB, user } = await loadFixture(deploy);

      const amountIn = 1000n;
      const minAmountOut = 900n;

      // Transfer some tokens to the user
      await tokenA.write.transfer([swapRouter.address, amountIn], { account: user.account });

      // Execute swap
      await swapRouter.write.swap(
        [tokenA.address, tokenB.address, amountIn, 0n, user.account.address, DexType.UNISWAP_V2],
        { account: user.account }
      );

      // Verify token balances changed appropriately
      const finalBalance = await tokenB.read.balanceOf([user.account.address]);
      expect(finalBalance).to.be.gte(minAmountOut);
    });

    it("should execute V3 swap with correct parameters", async function () {
      const { swapRouter, usdc: tokenA, wrappedNative: tokenB, user } = await loadFixture(deploy);

      const amountIn = 1000n;
      const minAmountOut = 900n;

      // Transfer some tokens to the user
      await tokenA.write.transfer([swapRouter.address, amountIn], { account: user.account });

      // Execute swap
      await swapRouter.write.swap(
        [tokenA.address, tokenB.address, amountIn, minAmountOut, user.account.address, DexType.UNISWAP_V3],
        { account: user.account }
      );

      // Verify token balances changed appropriately
      const finalBalance = await tokenB.read.balanceOf([user.account.address]);
      expect(finalBalance).to.be.gte(minAmountOut);
    });

    it("should execute multi-hop swap with path", async function () {
      const { swapRouter, usdc: tokenA, wrappedNative: tokenB, wrappedNative, user } = await loadFixture(deploy);

      const amountIn = 1000n;
      const minAmountOut = 800n;

      // Transfer some tokens to the user
      await tokenA.write.transfer([swapRouter.address, amountIn], { account: user.account });

      // Execute multi-hop swap through wrapped native token
      await swapRouter.write.swapWithPath(
        [
          [tokenA.address, wrappedNative.address, tokenB.address], // path
          amountIn,
          minAmountOut,
          user.account.address,
          DexType.UNISWAP_V3,
        ],
        { account: user.account }
      );

      // Verify token balances changed appropriately
      const finalBalance = await tokenB.read.balanceOf([user.account.address]);
      expect(finalBalance).to.be.gte(minAmountOut);
    });

    it("should get accurate V3 quotes", async function () {
      const { swapRouter, usdc: tokenA, wrappedNative: tokenB } = await loadFixture(deploy);

      const amountIn = 1000n;

      // Get quote for direct swap
      const quote = await swapRouter.read.getQuoteV3([tokenA.address, tokenB.address, amountIn, DexType.UNISWAP_V3]);

      expect(quote).to.be.gt(0n);
    });

    // it("should fail when using unsupported DEX", async function () {
    //   const { swapRouter, usdc: tokenA, wrappedNative: tokenB, user } = await loadFixture(deploy);

    //   const amountIn = 1000n;
    //   const minAmountOut = 900n;

    //   // Attempt swap with invalid DEX type
    //   await expect(
    //     swapRouter.write.swap(
    //       [
    //         tokenA.address,
    //         tokenB.address,
    //         amountIn,
    //         minAmountOut,
    //         user.account.address,
    //         9999, // Invalid DEX type
    //       ],
    //       { account: user.account }
    //     )
    //   ).to.be.rejectedWith("unsupported dex type");
    // });
  });
};
