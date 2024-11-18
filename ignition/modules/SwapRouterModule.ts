import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { DexType } from "../../utils/types";

export default buildModule("SwapRouterModule", (m) => {
  const wrappedNativeAddress = m.getParameter("wrappedNative");

  // we should have used a mapping instead of arrays, but ignition doesn't allow us to read the parameters
  const v3Routers = m.getParameter<string[]>("v3Routers");
  const v3Factories = m.getParameter<string[]>("v3Factories");
  const v2Routers = m.getParameter<string[]>("v2Routers");

  const v2RouterIndex = [DexType.UNISWAP_V2, DexType.SUSHISWAP_V2];
  const v3RouterAndFactoryIndex = [DexType.UNISWAP_V3, DexType.SUSHISWAP_V3];

  const swapRouter = m.contract("SwapRouter", [
    wrappedNativeAddress,
    v2RouterIndex,
    v2Routers,
    v3RouterAndFactoryIndex,
    v3Routers,
    v3Factories,
  ]);

  return { swapRouter };
});
