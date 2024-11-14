import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import SwapRouterModule from "../SwapRouterModule";
import GammaZapperModule from "./GammaZapperModule";

export default buildModule("GammaVaultFactoryModule", (m) => {
  m.useModule(SwapRouterModule);
  m.useModule(GammaZapperModule);

  const devAccount = m.getAccount(0);
  const vaultFactory = m.contract("GammaVaultFactory", [devAccount]);

  return { vaultFactory };
});
