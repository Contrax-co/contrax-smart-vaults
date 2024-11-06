import hre from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { Address, encodeAbiParameters, getAddress, zeroAddress } from "viem";
import { WalletClient } from "@nomicfoundation/hardhat-viem/types";
import { ContractTypesMap } from "hardhat/types";
import { bytecode as MockStrategyBytecode } from "../artifacts/contracts/mocks/MockStrategy.sol/MockStrategy.json";

export type DeployVaultFactoryFixture = () => Promise<{
  governance: WalletClient;
  strategist: WalletClient;
  timelock: WalletClient;
  devfund: WalletClient;
  treasury: WalletClient;
  user: WalletClient;
  vaultAsset: Address;
  VaultFactory: ContractTypesMap["IVaultFactory"];
  strategyBytecode: Address;
  strategyExtraParams: Address;
}>;

const testVaultConfiguration = async (
  VaultFactory: ContractTypesMap["IVaultFactory"],
  vaultAsset: Address,
  governance: WalletClient,
  strategist: WalletClient,
  timelock: WalletClient,
  devfund: WalletClient,
  treasury: WalletClient
) => {
  // Get vault address
  const vaultAddress = await VaultFactory.read.vaults([vaultAsset]);
  expect(vaultAddress).to.not.equal(zeroAddress);

  // Get controller address
  const controllerAddress = await VaultFactory.read.controllers([vaultAddress]);
  expect(controllerAddress).to.not.equal(zeroAddress);

  // Get strategy address
  const strategyAddress = await VaultFactory.read.strategies([vaultAddress]);
  expect(strategyAddress).to.not.equal(zeroAddress);

  // Verify vault configuration
  const Vault = await hre.viem.getContractAt("Vault", vaultAddress);
  expect(await Vault.read.token()).to.equal(vaultAsset);
  expect(await Vault.read.governance()).to.equal(
    getAddress(governance.account.address)
  );
  expect(await Vault.read.timelock()).to.equal(
    getAddress(timelock.account.address)
  );
  expect(await Vault.read.controller()).to.equal(controllerAddress);

  // Verify controller configuration
  const Controller = await hre.viem.getContractAt(
    "Controller",
    controllerAddress
  );
  expect(await Controller.read.strategies([vaultAsset])).to.equal(
    strategyAddress
  );
  expect(await Controller.read.vaults([vaultAsset])).to.equal(vaultAddress);
  expect(
    await Controller.read.approvedStrategies([vaultAsset, strategyAddress])
  ).to.be.true;
  expect(await Controller.read.governance()).to.equal(
    getAddress(governance.account.address)
  );
  expect(await Controller.read.strategist()).to.equal(
    getAddress(strategist.account.address)
  );
  expect(await Controller.read.timelock()).to.equal(
    getAddress(timelock.account.address)
  );
  expect(await Controller.read.devfund()).to.equal(
    getAddress(devfund.account.address)
  );
  expect(await Controller.read.treasury()).to.equal(
    getAddress(treasury.account.address)
  );

  // Verify strategy configuration
  const Strategy = await hre.viem.getContractAt("IStrategy", strategyAddress);
  expect(await Strategy.read.want()).to.equal(vaultAsset);
  expect(await Strategy.read.governance()).to.equal(
    getAddress(governance.account.address)
  );
  expect(await Strategy.read.strategist()).to.equal(
    getAddress(strategist.account.address)
  );
  expect(await Strategy.read.controller()).to.equal(controllerAddress);
  expect(await Strategy.read.timelock()).to.equal(
    getAddress(timelock.account.address)
  );
};

// TODO: use the same test for MockVaultFactory
export const doVaultFactoryTests = async (
  deploy: DeployVaultFactoryFixture
) => {
  describe("VaultFactory Test", function () {
    it("should fail when non-governance tries to create vault", async function () {
      const {
        governance,
        strategist,
        timelock,
        devfund,
        treasury,
        user,
        vaultAsset,
        VaultFactory,
        strategyBytecode,
        strategyExtraParams,
      } = await loadFixture(deploy);

      // Try to create vault from non-governance account
      await expect(
        VaultFactory.write.createVault(
          [
            vaultAsset,
            governance.account.address,
            strategist.account.address,
            timelock.account.address,
            devfund.account.address,
            treasury.account.address,
            strategyBytecode,
            strategyExtraParams,
          ],
          { account: user.account }
        )
      ).to.be.rejectedWith("!governance");
    });

    it("should create vault with custom strategy bytecode with proper configuration", async function () {
      const {
        governance,
        strategist,
        timelock,
        devfund,
        treasury,
        vaultAsset,
        VaultFactory,
        strategyBytecode,
        strategyExtraParams,
      } = await loadFixture(deploy);

      if (!strategyBytecode) throw new Error("Failed to get strategy bytecode");

      // Create vault with custom strategy bytecode
      await VaultFactory.write.createVault([
        vaultAsset,
        governance.account.address,
        strategist.account.address,
        timelock.account.address,
        devfund.account.address,
        treasury.account.address,
        strategyBytecode,
        strategyExtraParams, // extra params
      ]);

      // Verify vault was created
      const vaultAddress = await VaultFactory.read.vaults([vaultAsset]);
      expect(vaultAddress).to.not.equal(zeroAddress);

      await testVaultConfiguration(
        VaultFactory,
        vaultAsset,
        governance,
        strategist,
        timelock,
        devfund,
        treasury
      );
    });
  });
};

describe("Mock VaultFactory Test", function () {
  const deployVaultFactory = async () => {
    const [governance, strategist, timelock, devfund, treasury, user] =
      await hre.viem.getWalletClients();

    const vaultAsset = await hre.viem.deployContract("MockERC20", [
      "Vault Token",
      "VT",
    ]);

    const rewardToken = await hre.viem.deployContract("MockERC20", [
      "Reward Token",
      "RWT",
    ]);
    const staking = await hre.viem.deployContract("MockStaking", [
      vaultAsset.address,
      rewardToken.address,
    ]);

    // Deploy the GammaVaultFactory
    const VaultFactory = await hre.viem.deployContract("MockVaultFactory", [
      governance.account.address,
    ]);

    return {
      governance,
      strategist,
      timelock,
      devfund,
      treasury,
      user,
      vaultAsset: getAddress(vaultAsset.address),
      VaultFactory,
      strategyBytecode: MockStrategyBytecode as Address,
      strategyExtraParams: encodeAbiParameters(
        [{ type: "address" }],
        [staking.address]
      ),
    };
  };

  it("should create a mock vault with proper configuration", async function () {
    const {
      governance,
      strategist,
      timelock,
      devfund,
      treasury,
      vaultAsset,
      VaultFactory,
    } = await loadFixture(deployVaultFactory);

    const rewardToken = await hre.viem.deployContract("MockERC20", [
      "Reward Token",
      "RWT",
    ]);
    const staking = await hre.viem.deployContract("MockStaking", [
      vaultAsset,
      rewardToken.address,
    ]);

    // Create vault with custom strategy bytecode
    await VaultFactory.write.createVault([
      vaultAsset,
      governance.account.address,
      strategist.account.address,
      timelock.account.address,
      devfund.account.address,
      treasury.account.address,
      staking.address,
    ]);

    // Verify vault was created
    const vaultAddress = await VaultFactory.read.vaults([vaultAsset]);
    expect(vaultAddress).to.not.equal(zeroAddress);

    await testVaultConfiguration(
      VaultFactory as unknown as ContractTypesMap["IVaultFactory"],
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
      VaultFactory,
    } = await loadFixture(deployVaultFactory);

    const staking = await hre.viem.deployContract("MockStaking", [
      vaultAsset,
      vaultAsset,
    ]);

    // Try to create vault from non-governance account
    await expect(
      // Create vault with custom strategy bytecode
      VaultFactory.write.createVault(
        [
          vaultAsset,
          governance.account.address,
          strategist.account.address,
          timelock.account.address,
          devfund.account.address,
          treasury.account.address,
          staking.address,
        ],
        { account: user.account }
      )
    ).to.be.rejectedWith("!governance");
  });

  it("should fail when non-governance tries to create vault with custom strategy bytecode", async function () {
    const {
      governance,
      strategist,
      timelock,
      devfund,
      treasury,
      user,
      vaultAsset,
      VaultFactory,
      strategyBytecode,
      strategyExtraParams,
    } = await loadFixture(deployVaultFactory);

    // Try to create vault from non-governance account
    await expect(
      VaultFactory.write.createVault(
        [
          vaultAsset,
          governance.account.address,
          strategist.account.address,
          timelock.account.address,
          devfund.account.address,
          treasury.account.address,
          strategyBytecode,
          strategyExtraParams,
        ],
        { account: user.account }
      )
    ).to.be.rejectedWith("!governance");
  });

  it("should create vault with custom strategy bytecode with proper configuration", async function () {
    const {
      governance,
      strategist,
      timelock,
      devfund,
      treasury,
      vaultAsset,
      VaultFactory,
      strategyBytecode,
      strategyExtraParams,
    } = await loadFixture(deployVaultFactory);

    if (!strategyBytecode) throw new Error("Failed to get strategy bytecode");

    // Create vault with custom strategy bytecode
    await VaultFactory.write.createVault([
      vaultAsset,
      governance.account.address,
      strategist.account.address,
      timelock.account.address,
      devfund.account.address,
      treasury.account.address,
      strategyBytecode,
      strategyExtraParams, // extra params
    ]);

    // Verify vault was created
    const vaultAddress = await VaultFactory.read.vaults([vaultAsset]);
    expect(vaultAddress).to.not.equal(zeroAddress);

    await testVaultConfiguration(
      VaultFactory as unknown as ContractTypesMap["IVaultFactory"],
      vaultAsset,
      governance,
      strategist,
      timelock,
      devfund,
      treasury
    );
  });
});
