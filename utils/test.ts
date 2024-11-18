import hre, { viem } from "hardhat";
import { ContractTypesMap } from "hardhat/types";
import { Address, encodePacked, hexToBytes, keccak256, maxUint256, padHex, toHex, WalletClient } from "viem";

export const depositAndEarnInVault = async (
  vault: ContractTypesMap["Vault"],
  vaultAsset: ContractTypesMap["ERC20"],
  user: WalletClient,
  amount?: bigint
) => {
  await vaultAsset.write.approve([vault.address, maxUint256], { account: user.account });
  // deposit into vault
  if (amount) {
    await vault.write.deposit([amount], { account: user.account });
  } else {
    await vault.write.depositAll({ account: user.account });
  }
  // call earn to deposit into strategy
  await vault.write.earn();
};

export async function overwriteTokenAmount(assetAddr: Address, walletAddr: string, amount: string, slot: number = 0) {
  // Calculate the storage slot index using the slot and address

  const index = keccak256(encodePacked(["uint256", "uint256"], [walletAddr as unknown as bigint, BigInt(slot)]));

  // Convert the amount into a 32-byte hexadecimal value
  const BN = BigInt(amount);
  const number = toHex(BN, { size: 32 });

  // Set the storage value at the calculated index

  await hre.network.provider.send("hardhat_setStorageAt", [assetAddr, index, number]);

  // (await hre.viem.getTestClient()).setStorageAt({ address: walletAddr, index: index, value: number });

  // Mine a new block
  await hre.network.provider.send("evm_mine");
}

// export async function overwriteTokenAmount(assetAddr: string, walletAddr: string, amount: string, slot: number = 0) {

//   const index = ethers.utils.solidityKeccak256(["uint256", "uint256"], [walletAddr, slot]);
//   const BN = ethers.BigNumber.from(amount)._hex.toString();
//   const number = ethers.utils.hexZeroPad(BN, 32);

//   await ethers.provider.send("hardhat_setStorageAt", [assetAddr, index, number]);
//   await hre.network.provider.send("evm_mine");
// }

export async function increaseBlock(block: number) {
  for (let i = 1; i <= block; i++) {
    await hre.network.provider.send("evm_mine");
  }
}

export async function increaseTime(sec: number) {
  await hre.network.provider.send("evm_increaseTime", [sec]);
  await hre.network.provider.send("evm_mine");
}
