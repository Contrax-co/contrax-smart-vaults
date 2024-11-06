import hre from "hardhat";
import { Address, getAddress } from "viem";
import { bytecode as GammaStrategyBytecode } from "../artifacts/contracts/strategies/GammaStrategy.sol/GammaStrategy.json";
import { DeployFixture, doProtocolTest } from "./protocol.test";
import { ContractTypesMap } from "hardhat/types";

const assets = [
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
        VaultFactory: VaultFactory as unknown as ContractTypesMap["VaultFactoryBase"],
        strategyBytecode: GammaStrategyBytecode as Address,
        strategyExtraParams: "0x",
      };
    };
  };

  doProtocolTest({
    protocolName: "Gamma",
    vaultAssets: assets.map((e) => getAddress(e)),
    getDeployFixture,
  });
};

// doGammaTest();
