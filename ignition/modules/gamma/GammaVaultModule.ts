import SwapRouterModule from "../SwapRouterModule";
import GammaZapperModule from "./GammaZapperModule";
import GammaVaultFactoryModule from "./GammaVaultFactoryModule";
import { IgnitionModuleBuilder } from "@nomicfoundation/ignition-core";
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export const buildGammaCustomVaultModule = (m: IgnitionModuleBuilder, assetName: string) => {
  const { swapRouter } = m.useModule(SwapRouterModule);
  const { zapper, wrappedNative, usdc } = m.useModule(GammaZapperModule);
  const { vaultFactory } = m.useModule(GammaVaultFactoryModule);

  const devAccount = m.getAccount(0);
  const assetAddress = m.getParameter(`${assetName}.address`);
  const governance = m.getParameter("governance");
  const strategist = m.getParameter("strategist");
  const timelock = m.getParameter("timelock");
  const devfund = m.getParameter("devfund");
  const treasury = m.getParameter("treasury");

  const vaultCreatedEvent = m.call(
    vaultFactory,
    "createVault(address,address,address,address,address,address)",
    [assetAddress, governance, strategist, timelock, devfund, treasury],
    {
      from: devAccount,
      id: `CreateVault_${assetName}`,
    }
  );

  const assetParam = m.readEventArgument(vaultCreatedEvent, "VaultCreated", "asset", {
    id: `VaultCreatedEvent_Asset_${assetName}`,
  });
  const vaultParam = m.readEventArgument(vaultCreatedEvent, "VaultCreated", "vault", {
    id: `VaultCreatedEvent_Vault_${assetName}`,
  });
  const strategyParam = m.readEventArgument(vaultCreatedEvent, "VaultCreated", "strategy", {
    id: `VaultCreatedEvent_Strategy_${assetName}`,
  });
  const controllerParam = m.readEventArgument(vaultCreatedEvent, "VaultCreated", "controller", {
    id: `VaultCreatedEvent_Controller_${assetName}`,
  });

  const vaultWhitelistedEvent = m.call(zapper, "setWhitelistVault", [vaultParam, true], {
    from: devAccount,
    id: `VaultWhitelistedEvent_${assetName}`,
  });

  const vault = m.contractAt("Vault", vaultParam, { id: `Vault_${assetName}` });
  const strategy = m.contractAt("GammaStrategy", strategyParam, { id: `Strategy_${assetName}` });
  const controller = m.contractAt("Controller", controllerParam, { id: `Controller_${assetName}` });
  const asset = m.contractAt("ERC20", assetParam, { id: `Asset_${assetName}` });

  return { vault, strategy, controller, asset, vaultFactory, swapRouter, zapper, wrappedNative, usdc };
};

export default buildModule("GammaVaultModule", (m) => {
  const WpolWeth = buildGammaCustomVaultModule(m, "WpolWeth");
  // const WbtcWeth = buildGammaCustomVaultModule(m, "WbtcWeth");
  // const UsdcWeth = buildGammaCustomVaultModule(m, "UsdcWeth");

  return {
    // WpolWeth
    WpolWethAsset: WpolWeth.asset,
    WpolWethVault: WpolWeth.vault,
    WpolWethStrategy: WpolWeth.strategy,
    WpolWethController: WpolWeth.controller,
    // WbtcWeth
    // WbtcWethAsset: WbtcWeth.asset,
    // WbtcWethVault: WbtcWeth.vault,
    // WbtcWethStrategy: WbtcWeth.strategy,
    // WbtcWethController: WbtcWeth.controller,
    // // UsdcWeth
    // UsdcWethAsset: UsdcWeth.asset,
    // UsdcWethVault: UsdcWeth.vault,
    // UsdcWethStrategy: UsdcWeth.strategy,
    // UsdcWethController: UsdcWeth.controller,
  };
});
