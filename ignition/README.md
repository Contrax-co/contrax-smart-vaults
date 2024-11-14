# Deployment Guide for New Protocols

This guide details the steps and structure required to deploy new protocols and associated contract modules using Hardhat Ignition.

## Project Structure

For each protocol, create a dedicated folder containing modules for:

- **Zapper**
- **Vault**
- **Vault Factory**

Additionally, each protocol should utilize a common **SwapRouterModule**, as this module is shared across all networks.

Network-specific configuration parameters are stored under:

```
config/chain-<chainId>/parameters.json5
```

## Deployment Components

### 1. **SwapRouterModule**

This module is shared across all networks and provides core dependencies for swap functionality. It includes necessary parameters for governance, strategist, and treasury, as well as addresses for Uniswap and SushiSwap routers and factories (both V2 and V3).

**Parameters:**

```json5
{
  governance: "<address>",
  strategist: "<address>",
  timelock: "<address>",
  devfund: "<address>",
  treasury: "<address>",
  weth: "<address>",
  usdc: "<address>",
  v3Routers: ["<address>", "<address>"],
  v3Factories: ["<address>", "<address>"],
  v2Routers: ["<address>", "<address>"],
}
```

### 2. **VaultFactoryModule**

Each protocol includes a Vault Factory Module that is responsible for initializing and managing protocol-specific vaults. The module is configured to support deployment of multiple vaults with different assets.

The example code in `GammaVaultFactoryModule.ts` sets up the factory with parameters, creates a vault instance, and returns the vault factory contract.

**Parameters:**

```json5
{
  governance: "<address>",
  strategist: "<address>",
  timelock: "<address>",
}
```

### 3. **ZapperModule**

The Zapper module is responsible for handling asset conversion and entry for each protocol. It depends on **SwapRouterModule** and retrieves parameters for governance, WETH, USDC, and the protocol’s `gammaUniProxy` (extra param).

**Parameters:**

```json5
{
  governance: "<address>",
  weth: "<address>",
  usdc: "<address>",
  gammaUniProxy: "<address>",
}
```

### 4. **VaultModule**

This module configures each individual vault within a protocol. For each asset, a vault is created via the Vault Factory with specific parameters such as governance, strategist, timelock, devfund, and treasury.

The `GammaVaultModule.ts` file demonstrates the setup for multiple assets (e.g., WETH, WBTC, USDC) using `buildGammaCustomVaultModule` which creates a custom vault per asset.

**Parameters:**

```json5
{
  governance: "<address>",
  strategist: "<address>",
  timelock: "<address>",
  devfund: "<address>",
  treasury: "<address>",
  assetAddress: "<address>",
}
```

## Deployment Steps

### Step 1: Configure Network Parameters

For each new network, create a `parameters.json5` file in the `config/chain-<chainId>` directory. Define the addresses for governance, treasury, strategist, and any protocol and asset-specific parameters required by the modules.

### Step 2: Set Up Protocol Directory

For a new protocol, create a folder structured as follows:

```
/protocols/<ProtocolName>
  ├── GammaVaultFactoryModule.ts
  ├── GammaZapperModule.ts
  └── GammaVaultModule.ts
```

### Step 3: Configure Modules

- **GammaVaultFactoryModule**: Set up and configure vault creation logic within the factory module.
- **GammaZapperModule**: Configure asset entry and zapper logic by connecting to `SwapRouterModule`.
- **GammaVaultModule**: Define each asset to be used with the protocol’s vaults.

### Step 4: Deploy Contracts

Run the deployment scripts to deploy the modules:

```bash
npx hardhat ignition deploy ignition/modules/<protocol-name>/<protocol-name>VaultModule.ts --parameters ignition/config/chain-<chainId>/parameters.json5 --network <network-name> --verify
```

Ensure that each module is properly registered in Hardhat Ignition and that the `parameters.json5` file is correctly configured for the network you are deploying to.

### Step 5: Test Deployments

It’s recommended to test each deployment in a local or test environment to ensure all contracts are deployed correctly and parameters are set as expected.

### Known Issues

- **Global Variables**: Hardhat Ignition global variables are not working as expected.
