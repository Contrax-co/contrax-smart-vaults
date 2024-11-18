import { Address, erc20Abi, PublicClient, encodePacked, keccak256, toHex } from "viem";

export const findERC20BalanceSlot = async (
  tokenSymbol: string,
  tokenAddress: Address,
  tokenHolderAddress: Address,
  publicClient: PublicClient,
  maxSlot: number
) => {
  const holderBal = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [tokenHolderAddress],
  });

  console.log("User balance", holderBal);

  if (holderBal === 0n) {
    throw new Error(`Token holder ${tokenHolderAddress} does not hold any tokens for ${tokenSymbol}`);
  }

  // Solidity is key, slot
  for (let i = 0; i <= maxSlot; i++) {
    const slotIndex = keccak256(
      encodePacked(["uint256", "uint256"], [tokenHolderAddress as unknown as bigint, BigInt(i)])
    );
    const storageValue = await publicClient.getStorageAt({
      address: tokenAddress,
      slot: slotIndex,
    });

    let n = BigInt(storageValue as string);
    if (n === holderBal) {
      return i;
    }
  }

  throw new Error(
    `No slot number corresponds to balanceOf for ${tokenSymbol} with solidity mapping format (key, slot)`
  );
};
