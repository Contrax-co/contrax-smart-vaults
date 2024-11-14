import hre from "hardhat";
import { Address, getAddress, zeroAddress } from "viem";
import { bytecode as GammaStrategyBytecode } from "../artifacts/contracts/strategies/GammaStrategy.sol/GammaStrategy.json";
import { DeployFixture, doProtocolTest } from "./protocol.test";
import { ContractTypesMap } from "hardhat/types";
import { testVaultConfiguration } from "./vaultFactory.test";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const assets: Address[] = [
  "0x02203f2351E7aC6aB5051205172D3f772db7D814", // WpolWeth
];

const doGammaTest = async () => {
  const getDeployFixture = (asset: Address): DeployFixture => {
    return async () => {
      const [governance, strategist, timelock, devfund, treasury, user] = await hre.viem.getWalletClients();

      // Deploy vault asset
      const vaultAsset = await hre.viem.getContractAt("ERC20", asset);

      // Deploy the GammaVaultFactory
      const VaultFactory = await hre.viem.deployContract("GammaVaultFactory", [governance.account.address]);
      // TODO: Remove mock
      const swapRouter = await hre.viem.deployContract("MockSwapRouter", [governance.account.address]);
      const wrappedNative = await hre.viem.deployContract("MockWETH", []);
      const usdc = await hre.viem.deployContract("MockERC20", ["USD Coin", "USDC"]);
      const zapper = await hre.viem.deployContract("GammaZapper", [
        governance.account.address,
        wrappedNative.address,
        usdc.address,
        swapRouter.address,
        [],
        governance.account.address,
      ]);

      // Create vault with custom strategy bytecode
      await VaultFactory.write.createVault([
        vaultAsset.address,
        governance.account.address,
        strategist.account.address,
        timelock.account.address,
        devfund.account.address,
        treasury.account.address,
      ]);

      const controllerAddress = await VaultFactory.read.controllers([vaultAsset.address]);
      const vaultAddress = await VaultFactory.read.vaults([vaultAsset.address]);
      const strategyAddress = await VaultFactory.read.strategies([vaultAsset.address]);

      const controller = await hre.viem.getContractAt("Controller", controllerAddress);
      const vault = await hre.viem.getContractAt("Vault", vaultAddress);
      const strategy = await hre.viem.getContractAt("StrategyBase", strategyAddress);

      return {
        stakable: false,
        governance,
        strategist,
        timelock,
        devfund,
        treasury,
        user,
        vaultAsset,
        vault,
        strategy: strategy as unknown as ContractTypesMap["StrategyBase"],
        controller,
        vaultFactory: VaultFactory as unknown as ContractTypesMap["VaultFactoryBase"],
        strategyBytecode: GammaStrategyBytecode as Address,
        strategyExtraParams: "0x",
        maxSlippage: 1n,
        swapRouter: swapRouter as unknown as ContractTypesMap["ISwapRouter"],
        wrappedNative: wrappedNative as unknown as ContractTypesMap["MockWETH"],
        usdc: usdc as unknown as ContractTypesMap["ERC20"],
        zapper: zapper as unknown as ContractTypesMap["ZapperBase"],
        usdcDecimals: 6,
      };
    };
  };

  describe("Gamma Protocol Test", function () {
    it("should create a mock vault with proper configuration", async function () {
      const {
        governance,
        strategist,
        timelock,
        devfund,
        treasury,
        vaultAsset,
        vaultFactory: VaultFactory,
      } = await loadFixture(getDeployFixture(assets[0]));

      // Verify vault was created
      const vaultAddress = await VaultFactory.read.vaults([vaultAsset.address]);
      expect(vaultAddress).to.not.equal(zeroAddress);

      await testVaultConfiguration(
        VaultFactory as unknown as ContractTypesMap["VaultFactoryBase"],
        vaultAsset,
        governance,
        strategist,
        timelock,
        devfund,
        treasury
      );
    });

    it("should fail when non-governance tries to create vault", async function () {
      const {
        governance,
        strategist,
        timelock,
        devfund,
        treasury,
        user,
        vaultAsset,
        vaultFactory: VaultFactory,
      } = await loadFixture(getDeployFixture(assets[0]));

      // Try to create vault from non-governance account
      await expect(
        (VaultFactory as unknown as ContractTypesMap["GammaVaultFactory"]).write.createVault(
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
        (VaultFactory as unknown as ContractTypesMap["GammaVaultFactory"]).write.createVault(
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
      ).to.be.rejectedWith("!governance");
    });
  });

  doProtocolTest({
    protocolName: "Gamma",
    vaultAssets: assets.map((e) => getAddress(e)),
    getDeployFixture,
  });
};

// doGammaTest();
