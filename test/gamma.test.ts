import hre from "hardhat";
import { Address, getAddress, parseEventLogs, parseUnits, zeroAddress } from "viem";
import { bytecode as GammaStrategyBytecode } from "../artifacts/contracts/strategies/GammaStrategy.sol/GammaStrategy.json";
import { DeployFixture, doProtocolTest } from "./protocol.test";
import { ContractTypesMap } from "hardhat/types";
import { testVaultConfiguration } from "./vaultFactory.test";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { overwriteTokenAmount } from "../utils/test";
import { doSwapRouterTests } from "./swapRouter.test";

enum DexType {
  UNISWAP_V2 = 0,
  UNISWAP_V3 = 1,
  SUSHISWAP_V2 = 2,
  SUSHISWAP_V3 = 3,
  CAMELOT_V3 = 4,
}
const assets = [getAddress("0x02203f2351E7aC6aB5051205172D3f772db7D814")]; // WpolWeth
const swapRouterV2 = [getAddress("0xedf6066a2b290C185783862C7F4776A2C8077AD1")];
const swapRouterV3 = [
  getAddress("0xE592427A0AEce92De3Edee1F18E0157C05861564"),
  getAddress("0x0aF89E1620b96170e2a9D0b68fEebb767eD044c3"),
];
const swapfactoryV3 = [
  getAddress("0x1F98431c8aD98523631AE4a59f267346ea31F984"),
  getAddress("0x917933899c6a5F8E37F31E19f92CdBFF7e8FF0e2"),
];
const dexIndexV2: number[] = [Number(DexType.UNISWAP_V2)];
const dexIndexV3: number[] = [Number(DexType.UNISWAP_V3), Number(DexType.SUSHISWAP_V3)];
const wrappedNativeAddress = getAddress("0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270");
const usdcAddress = getAddress("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359");
const gammaUniProxyAddress = getAddress("0xA42d55074869491D60Ac05490376B74cF19B00e6");
const usdcDecimals = 6;
const usdcAmount = parseUnits("1000000", usdcDecimals);

const doGammaTest = async () => {
  const getDeployFixture = (asset: Address): DeployFixture => {
    return async () => {
      const [governance, strategist, timelock, devfund, treasury, user] = await hre.viem.getWalletClients();

      const vaultAsset = await hre.viem.getContractAt("ERC20", asset);
      const VaultFactory = await hre.viem.deployContract("GammaVaultFactory", [governance.account.address]);
      const swapRouter = await hre.viem.deployContract("SwapRouter", [
        wrappedNativeAddress,
        dexIndexV2,
        swapRouterV2,
        dexIndexV3,
        swapRouterV3,
        swapfactoryV3,
      ]);
      const usdc = await hre.viem.getContractAt("ERC20", usdcAddress);

      // Create vault with custom strategy bytecode
      const tx = await VaultFactory.write.createVault([
        vaultAsset.address,
        governance.account.address,
        strategist.account.address,
        timelock.account.address,
        devfund.account.address,
        treasury.account.address,
      ]);

      const receipt = await (await hre.viem.getPublicClient()).waitForTransactionReceipt({ hash: tx });
      const events = parseEventLogs({
        logs: receipt.logs,
        abi: VaultFactory.abi,
        eventName: "VaultCreated",
      });

      const controllerAddress = getAddress(events[0].args.controller);
      const vaultAddress = getAddress(events[0].args.vault);
      const strategyAddress = getAddress(events[0].args.strategy);

      const zapper = await hre.viem.deployContract("GammaZapper", [
        governance.account.address,
        wrappedNativeAddress,
        usdc.address,
        swapRouter.address,
        [vaultAddress],
        gammaUniProxyAddress,
      ]);

      const controller = await hre.viem.getContractAt("Controller", controllerAddress);
      const vault = await hre.viem.getContractAt("Vault", vaultAddress);
      const strategy = await hre.viem.getContractAt("StrategyBase", strategyAddress);
      const wrappedNative = await hre.viem.getContractAt("IWETH", wrappedNativeAddress);

      // mock usdc balance
      await overwriteTokenAmount(usdcAddress, user.account.address, usdcAmount.toString(), 9);

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
        controller,
        strategy: strategy as unknown as ContractTypesMap["StrategyBase"],
        vaultFactory: VaultFactory as unknown as ContractTypesMap["VaultFactoryBase"],
        swapRouter: swapRouter as unknown as ContractTypesMap["ISwapRouter"],
        zapper: zapper as unknown as ContractTypesMap["ZapperBase"],
        usdc: usdc as unknown as ContractTypesMap["ERC20"],
        strategyBytecode: GammaStrategyBytecode as Address,
        strategyExtraParams: "0x",
        maxSlippage: 1n,
        wrappedNative,
        usdcDecimals,
      };
    };
  };

  describe("Gamma Protocol Test", function () {
    it("should have correct usdc balance", async function () {
      const { user, usdc } = await loadFixture(getDeployFixture(assets[0]));
      const usdcBalance = await usdc.read.balanceOf([user.account.address]);
      expect(usdcBalance).to.equal(usdcAmount);
    });

    it("should create a Gamma vault with proper configuration", async function () {
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

    it("should fail when non-dev tries to create vault", async function () {
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
      ).to.be.rejectedWith("!dev");
    });
  });

  doSwapRouterTests(getDeployFixture(assets[0]));

  doProtocolTest({
    protocolName: "Gamma",
    vaultAssets: assets.map((e) => getAddress(e)),
    getDeployFixture,
  });
};

doGammaTest();
