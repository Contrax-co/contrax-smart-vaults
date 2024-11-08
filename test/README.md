# Protocol Testing Guide

This guide explains how to test existing protocols and add tests for new protocols in the system.

## Overview

The testing framework is designed to be modular and consistent across different protocols. It uses a standard set of tests that run against any protocol implementation, ensuring that all core functionality works as expected.

## Test Structure

The testing system consists of several key components:

1. **Protocol Test Runner (`protocol.test.ts`)**: Contains the main test runner `doProtocolTest` that executes standard test suites for:

   - Vault Factory
   - Controller
   - Strategy
   - Vault
   - Zapper

2. **Deploy Fixture**: Each protocol must implement a deployment fixture that sets up all necessary contracts and returns them in a standard format.

## Adding Tests for a New Protocol

To add tests for a new protocol, follow these steps:

1. Create a new test file named `[protocolName].test.ts` in the test directory.

2. Import necessary dependencies:

   ```typescript
   import hre from "hardhat";
   import { Address } from "viem";
   import { bytecode as YourStrategyBytecode } from "../artifacts/contracts/strategies/YourStrategy.sol/YourStrategy.json";
   import { DeployFixture, doProtocolTest } from "./protocol.test";
   import { ContractTypesMap } from "hardhat/types";
   ```

3. Define the assets you want to test with:

   ```typescript
   const assets = [
     "0x...", // Asset 1 description
     "0x...", // Asset 2 description
   ];
   ```

4. Create a deployment fixture function that implements the `DeployFixture` type. The fixture should:

   - Deploy or connect to all required contracts
   - Set up initial configurations
   - Return all required contracts and parameters

5. Create and run the protocol test:

   ```typescript
   const doYourProtocolTest = async () => {
     doProtocolTest({
       protocolName: "YourProtocol",
       vaultAssets: assets.map((e) => getAddress(e)),
       getDeployFixture,
     });
   };

   doYourProtocolTest();
   ```

## Example Implementations

You can refer to these example implementations:

1. **Mock Protocol** (`mock.test.ts`):

   - Shows both manual setup and factory-based setup approaches
   - Demonstrates how to handle staking functionality
   - Includes additional protocol-specific tests

2. **Gamma Protocol** (`gamma.test.ts`):
   - Shows a real protocol implementation
   - Demonstrates how to handle external protocol integrations
   - Uses factory-based setup

## Required Contract Returns

The deployment fixture must return all of these contracts and parameters:

```typescript
{
  stakable: boolean; // Whether protocol supports staking
  governance: WalletClient; // Governance wallet
  strategist: WalletClient; // Strategist wallet
  timelock: WalletClient; // Timelock wallet
  devfund: WalletClient; // Dev fund wallet
  treasury: WalletClient; // Treasury wallet
  user: WalletClient; // Test user wallet
  vaultFactory: VaultFactoryBase; // Protocol's vault factory
  vaultAsset: ERC20; // Main vault asset
  usdc: ERC20; // USDC token
  wrappedNative: MockWETH; // Wrapped native token
  zapper: ZapperBase; // Protocol zapper
  swapRouter: ISwapRouter; // Swap router interface
  vault: Vault; // Main vault contract
  strategy: StrategyBase; // Protocol strategy
  controller: Controller; // Vault controller
  strategyBytecode: Address; // Strategy contract bytecode
  strategyExtraParams: Address; // Extra parameters for strategy
  maxSlippage: bigint; // Maximum allowed slippage
}
```

## Running Tests

To run all protocol tests:

```bash
npx hardhat test
```

To run tests for a specific protocol:

```bash
npx hardhat test test/[protocolName].test.ts
```

## Important Notes

1. **Contract Requirements**:

   - Each protocol must implement all required contracts and interfaces
   - Strategy contracts must inherit from `StrategyBase`
   - Vault Factory must inherit from `VaultFactoryBase`

2. **Testing Considerations**:

   - Test both happy and unhappy paths
   - Include protocol-specific edge cases
   - Verify all access control mechanisms
   - Test integration with external protocols if applicable

3. **Best Practices**:
   - Use mock contracts for external dependencies when possible
   - Keep deployment fixtures clean and well-documented
   - Follow the existing test patterns for consistency
   - Add comments explaining protocol-specific test cases

For detailed examples, refer to `mock.test.ts` and `gamma.test.ts` in the test directory.
