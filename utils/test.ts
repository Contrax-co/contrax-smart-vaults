import { ContractTypesMap } from "hardhat/types";
import { maxUint256, WalletClient } from "viem";

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
