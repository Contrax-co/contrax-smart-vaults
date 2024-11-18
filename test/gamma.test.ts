import hre, { ignition } from "hardhat";
import { Address, parseUnits, zeroAddress } from "viem";
import { bytecode as GammaStrategyBytecode } from "../artifacts/contracts/strategies/GammaStrategy.sol/GammaStrategy.json";
import { DeployFixture, doProtocolTest } from "./protocol.test";
import { ContractTypesMap } from "hardhat/types";
import { testVaultConfiguration } from "./vaultFactory.test";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { overwriteTokenAmount } from "../utils/test";
import { BaseModuleParameters, VaultAsset } from "../utils/types";
import { buildGammaCustomVaultModule } from "../ignition/modules/gamma/GammaVaultModule";
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { getVaultAssets, readDeploymentParameters, replaceModuleAddresses, typeCastContract } from "../utils/common";

const protocolModuleName = "GammaVaultModule";
const moduleParameters: BaseModuleParameters = readDeploymentParameters(hre.network.config.chainId!);
const assets: VaultAsset[] = getVaultAssets(moduleParameters, protocolModuleName);
const usdcAmount = parseUnits("1000000", moduleParameters.usdcDecimals);
const ethAmount = parseUnits("1000000", 18);

const getDeployFixture = (asset: VaultAsset): DeployFixture => {
  return async () => {
    const [governance, strategist, timelock, devfund, treasury, user] = await hre.viem.getWalletClients();
    const parameters = await replaceModuleAddresses(moduleParameters, {
      governance: governance.account.address,
      strategist: strategist.account.address,
      timelock: timelock.account.address,
      devfund: devfund.account.address,
      treasury: treasury.account.address,
    });

    const contracts = await ignition.deploy(
      buildModule(protocolModuleName, (m) => buildGammaCustomVaultModule(m, asset.name)),
      {
        parameters,
      }
    );

    // mock balances
    await overwriteTokenAmount(
      moduleParameters.usdc,
      user.account.address,
      usdcAmount.toString(),
      moduleParameters.usdcBalanceSlot
    );
    await overwriteTokenAmount(asset.address, user.account.address, ethAmount.toString(), asset.balanceSlot);

    return {
      stakable: false,
      governance,
      strategist,
      timelock,
      devfund,
      treasury,
      user,
      vaultAsset: contracts.asset,
      vault: contracts.vault,
      controller: contracts.controller,
      strategy: typeCastContract("StrategyBase", contracts.strategy),
      vaultFactory: typeCastContract("VaultFactoryBase", contracts.vaultFactory),
      swapRouter: typeCastContract("ISwapRouter", contracts.swapRouter),
      zapper: typeCastContract("ZapperBase", contracts.zapper),
      usdc: typeCastContract("ERC20", contracts.usdc),
      strategyBytecode: GammaStrategyBytecode as Address,
      strategyExtraParams: "0x",
      maxSlippage: 1n,
      wrappedNative: contracts.wrappedNative,
      usdcDecimals: moduleParameters.usdcDecimals,
    };
  };
};

const doProtocolSpecificTest = (asset: VaultAsset) => {
  describe(`Protocol Specific ${asset.name} Test`, function () {
    it("should have correct usdc balance", async function () {
      const { user, usdc } = await loadFixture(getDeployFixture(asset));
      const usdcBalance = await usdc.read.balanceOf([user.account.address]);
      expect(usdcBalance).to.equal(usdcAmount);
    });

    it("should create a Gamma vault with proper configuration", async function () {
      const { governance, strategist, timelock, devfund, treasury, vaultAsset, vaultFactory } = await loadFixture(
        getDeployFixture(asset)
      );

      // Verify vault was created
      const vaultAddress = await vaultFactory.read.vaults([vaultAsset.address]);
      expect(vaultAddress).to.not.equal(zeroAddress);

      await testVaultConfiguration(
        vaultFactory as unknown as ContractTypesMap["VaultFactoryBase"],
        vaultAsset,
        governance,
        strategist,
        timelock,
        devfund,
        treasury
      );
    });

    it("should fail when non-dev tries to create vault", async function () {
      const { governance, strategist, timelock, devfund, treasury, user, vaultAsset, vaultFactory } = await loadFixture(
        getDeployFixture(asset)
      );

      // Try to create vault from non-governance account
      await expect(
        (vaultFactory as unknown as ContractTypesMap["GammaVaultFactory"]).write.createVault(
          [
            vaultAsset.address,
            governance.account.address,
            strategist.account.address,
            timelock.account.address,
            devfund.account.address,
            treasury.account.address,
          ],
          { account: governance.account }
        )
      ).to.be.rejectedWith("already exists");

      await expect(
        (vaultFactory as unknown as ContractTypesMap["GammaVaultFactory"]).write.createVault(
          [
            treasury.account.address, // temp token address
            governance.account.address,
            strategist.account.address,
            timelock.account.address,
            devfund.account.address,
            treasury.account.address,
          ],
          { account: user.account }
        )
      ).to.be.rejectedWith("!dev");
    });
  });
};

const doGammaTest = async () => {
  doProtocolTest({
    protocolName: "Gamma",
    vaultAssets: assets,
    getDeployFixture,
    doProtocolSpecificTest,
  });
};

doGammaTest();
