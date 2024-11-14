import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import SwapRouterModule from "../SwapRouterModule";

export default buildModule("GammaZapperModule", (m) => {
  const { swapRouter } = m.useModule(SwapRouterModule);
  const governance = m.getParameter("governance");
  const weth = m.getParameter("weth");
  const usdc = m.getParameter("usdc");
  const gammaUniProxy = m.getParameter("gammaUniProxy");

  const zapper = m.contract("GammaZapper", [governance, weth, usdc, swapRouter, [], gammaUniProxy]);

  return { zapper };
});
