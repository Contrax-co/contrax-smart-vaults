import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import SwapRouterModule from "../SwapRouterModule";

export default buildModule("GammaZapperModule", (m) => {
  const { swapRouter } = m.useModule(SwapRouterModule);
  const devAccount = m.getAccount(0);
  const wrappedNativeAddress = m.getParameter("wrappedNative");
  const usdcAddress = m.getParameter("usdc");
  const gammaUniProxy = m.getParameter("gammaUniProxy");

  const zapper = m.contract("GammaZapper", [
    devAccount,
    wrappedNativeAddress,
    usdcAddress,
    swapRouter,
    [],
    gammaUniProxy,
  ]);
  const wrappedNative = m.contractAt("IWETH", wrappedNativeAddress);
  const usdc = m.contractAt("ERC20", usdcAddress);

  return { zapper, wrappedNative, usdc };
});
