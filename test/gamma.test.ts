import hre from "hardhat";
import { Address, getAddress, zeroAddress } from "viem";
import { bytecode as GammaStrategyBytecode } from "../artifacts/contracts/strategies/GammaStrategy.sol/GammaStrategy.json";
import { DeployFixture, doProtocolTest } from "./protocol.test";
import { ContractTypesMap } from "hardhat/types";
import { testVaultConfiguration } from "./vaultFactory.test";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { overwriteTokenAmount } from "../utils/test";

let zapInUsdcAmount: string = "2500000000";

const assets: Address[] = [
  "0x02203f2351E7aC6aB5051205172D3f772db7D814", // WpolWeth
];

const swapRouterV3: Address[] = [
  "0xE592427A0AEce92De3Edee1F18E0157C05861564", // uniV3
  "0xFB7eF66a7e61224DD6FcD0D7d9C3be5C8B049b9f", // sushiV3
];
enum DexType {
  UNISWAP_V2 = 0,
  UNISWAP_V3 = 1,
  SUSHISWAP_V2 = 2,
  SUSHISWAP_V3 = 3,
  CAMELOT_V3 = 4,
}
const dexIndexV3: number[] = [Number(DexType.UNISWAP_V3), Number(DexType.SUSHISWAP_V3)];

const factoryV3: Address[] = [
  "0x1F98431c8aD98523631AE4a59f267346ea31F984", // uniV3
  "0xc35DADB65012eC5796536bD9864eD8773aBc74C4", // sushiV3
];

const wPol: Address = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const wethPol: Address = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
const GAMMA_UNIPROXY: Address = "0xA42d55074869491D60Ac05490376B74cF19B00e6";
let usdcPol: Address = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

const doGammaTest = async () => {
  const getDeployFixture = (asset: Address): DeployFixture => {
    return async () => {
      const [governance, strategist, timelock, devfund, treasury, user] = await hre.viem.getWalletClients();

      // Deploy vault asset
      const vaultAsset = await hre.viem.getContractAt("ERC20", asset);

      // Deploy the GammaVaultFactory
      const VaultFactory = await hre.viem.deployContract("GammaVaultFactory", [governance.account.address]);
      // TODO: Remove mock
      const swapRouter = await hre.viem.deployContract("SwapRouter", [
        wethPol,
        [],
        [],
        dexIndexV3,
        swapRouterV3,
        factoryV3,
      ]);

      // const wrappedNative = await hre.viem.deployContract("MockWETH", []);

      const usdc = await hre.viem.getContractAt("ERC20", usdcPol);

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

      const zapper = await hre.viem.deployContract("GammaZapper", [
        governance.account.address,
        wPol,
        usdc.address,
        swapRouter.address,
        [vaultAddress],
        GAMMA_UNIPROXY,
      ]);

      const controller = await hre.viem.getContractAt("Controller", controllerAddress);
      const vault = await hre.viem.getContractAt("Vault", vaultAddress);
      const strategy = await hre.viem.getContractAt("StrategyBase", strategyAddress);
      const wrappedNative = await hre.viem.getContractAt("MockWETH", wPol);

      // sending usdc balance
      await overwriteTokenAmount(usdcPol, user.account.address, zapInUsdcAmount, 9);

      //check usdc balance for user
      const usdcBalance = await usdc.read.balanceOf([user.account.address]);

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
