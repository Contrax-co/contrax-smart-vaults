import hre from "hardhat";
import { findERC20BalanceSlot } from "../utils/slot";

const tokenAddress = "0x4B9e26a02121a1C541403a611b542965Bd4b68Ce";
const tokenHolderAddress = "0xF7E326856009C52E9842B135723194EebA53a5Df";

const main = async () => {
  const slot = await findERC20BalanceSlot(
    "Asset",
    tokenAddress,
    tokenHolderAddress,
    await hre.viem.getPublicClient(),
    100
  );
  console.log("Slot", slot);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
