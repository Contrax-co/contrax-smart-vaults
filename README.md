# Contrax Smart Vaults

Contrax is a modular and efficient yield aggregator on the Ethereum Virtual Machine (EVM). It optimizes yield generation through a combination of smart contracts, providing users with a seamless way to earn APR on their assets. This documentation provides an in-depth overview of Contrax's architecture, components, and usage.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
  - [Vault](#vault)
  - [Controller](#controller)
  - [Strategy](#strategy)
  - [Zapper](#zapper)
- [Token Definitions](#token-definitions)
- [Workflow](#workflow)
  - [Deposits](#deposits)
  - [Earning Yield](#earning-yield)
  - [Withdrawals](#withdrawals)
  - [Harvesting](#harvesting)
- [Deployment Guide](#deployment-guide)
  - [Vault Setup Steps](#vault-setup-steps)
- [Contracts](#contracts)
- [Security Considerations](#security-considerations)
- [Notes](#notes)
- [Conclusion](#conclusion)
- [Adding New Protocols](#adding-new-protocols)

---

## Overview

Contrax leverages a modular smart contract system to maximize yield generation for users. It comprises three core components:

1. **Vault**: The entry point for users to deposit their assets.
2. **Controller**: Manages the interaction between the Vault and the Strategy.
3. **Strategy**: Implements the logic for investing assets into yield-generating platforms.

An additional periphery component, the **Zapper**, simplifies the process of converting single assets into the desired tokens required by the Vault.

---

## Architecture

### Vault

The Vault is the user-facing contract where users deposit their **assets**. In return, they receive **Vault shares**, which represent their proportional stake in the Vault's assets.

- **Deposit**: Users deposit assets into the Vault.
- **Earn**: Anyone can call the `earn` function to transfer assets from the Vault to the Controller.
- **Withdraw**: Users can redeem their Vault shares for assets at any time, based on the current exchange rate.

### Controller

The Controller acts as an intermediary between the Vault and the Strategy.

- **Strategy Management**: It manages the current investment Strategy and can update it via the `setStrategy` function.
- **Asset Flow**: Receives assets from the Vault and deposits them into the Strategy when `earn` is called.
- **Governance**: Maintains control over the assets through governance mechanisms.

### Strategy

The Strategy contract contains the specific logic for investing assets into underlying staking pools or yield-generating platforms.

- **Investment Logic**: Implements how and where to invest the assets to generate yield.
- **Harvesting**: A `harvest` function is called (typically every 24 hours) to compound rewards.
- **Access Control**: Only the Controller and authorized accounts can interact with the Strategy.

### Zapper

The Zapper simplifies the process of entering and exiting the Vault with different assets.

- **Asset Conversion**: Converts assets like ETH or USDC into the required assets for the Vault.
- **Liquidity Provision**: Handles adding liquidity or staking if the Vault requires staked or LP versions of tokens.

---

## Token Definitions

- **Assets**: The tokens that Contrax integrates with. Often an LP or staked version of another token.
- **Vault Shares**: The tokens users receive when they deposit into the Vault, representing their proportional share.

---

## Workflow

### Deposits

1. **User Deposits Assets**: Users deposit assets into the Vault.
2. **Receive Vault Shares**: Users receive Vault shares in proportion to their deposit.
3. **Assets Stay in Vault**: The deposited assets remain in the Vault until `earn` is called.

### Earning Yield

1. **Calling Earn**: Anyone can call the `earn` function on the Vault.
2. **Transfer to Controller**: The Vault transfers assets to the Controller.
3. **Controller Deposits into Strategy**: The Controller immediately deposits these assets into the Strategy.
4. **Yield Generation**: The Strategy invests the assets to generate yield.

### Withdrawals

1. **User Requests Withdrawal**: Users can redeem their Vault shares for assets.
2. **Vault Processes Withdrawal**:
   - If the Vault has enough assets, it fulfills the withdrawal directly.
   - If not, it requests the remaining assets from the Controller.
3. **Transfer Assets**: Assets are transferred back to the user.

### Harvesting

- **Auto-Compounding**: The `harvest` function is called by a designated harvester account (typically every 24 hours) to compound rewards.
- **Reward Distribution**: Harvesting increases the total assets in the Vault, thereby increasing the value of Vault shares.

---

## Adding New Protocols

To integrate a new protocol with Contrax, you'll need to create protocol-specific implementations of the Strategy and VaultFactory contracts. Here's the step-by-step process:

### 1. Create Protocol Strategy

Create a new strategy contract that implements `StrategyBase`:

```solidity
contract ProtocolStrategy is StrategyBase {
    // Protocol-specific storage variables
    IProtocolStaking public stakingContract;

    constructor(
        address _asset,
        address _governance,
        address _timelock,
        address _controller,
        address _stakingContract
    ) StrategyBase(_asset, _governance, _timelock, _controller) {
        stakingContract = IProtocolStaking(_stakingContract);
    }

    // Implement required functions
    function deposit() override external {
        // Protocol-specific deposit logic
    }

    function _withdrawSome(uint256 _amount) internal virtual override returns (uint256) {
        // Protocol-specific withdrawal logic
    }

    function harvest() override external {
        // Protocol-specific harvesting logic
    }

    function getHarvestable() external view override returns (address reward, uint256 amount) {
        // Protocol-specific harvesting logic
    }

    function balanceOfPool() public view virtual override returns (uint256) {
        // Protocol-specific underlying staking balance logic
    }
}
```

### 2. Create Protocol Factory

Create a new factory contract that implements `VaultFactoryBase`:

```solidity
contract ProtocolVaultFactory is VaultFactoryBase {
    constructor(address _governance) VaultFactoryBase(_governance) {}

    function createVault(
        address _token,
        address _governance,
        address _strategist,
        address _timelock,
        address _devfund,
        address _treasury,
        address _stakingContract
    ) external returns (address vault) {
        // 1. create controller and vault
        (controller, vault) = _createControllerAndVault(_token, _governance, _strategist, _timelock, _devfund, _treasury);

        // 2. create strategy
        address strategy = address(new ProtocolStrategy(
            _token,
            _governance,
            _timelock,
            controller,
            _stakingContract
        ));

        // 3. setup vault
        _setupVault(_token, vault, strategy, controller, _governance, _timelock);

        emit VaultCreated(_token, address(vault), address(strategy), address(controller), block.timestamp);
    }
}
```

### 3. Integration Steps

1. **Protocol Research**:

   - Understand the protocol's staking/farming mechanisms
   - Identify required interfaces and interactions
   - Document reward token paths and conversion strategies

2. **Contract Implementation**:

   - Implement the protocol-specific strategy
   - Create necessary interfaces for protocol interactions
   - Add protocol-specific parameters to factory constructor

3. **Testing**:

   - Write comprehensive tests for strategy functions
   - Test vault creation through factory
   - Verify reward harvesting and compounding

4. **Deployment**:
   - Deploy protocol factory
   - Grant necessary permissions
   - Create initial vaults through factory

### 4. Best Practices

- Always inherit from `StrategyBase` and `VaultFactoryBase`
- Implement proper access control
- Add emergency withdrawal functions
- Document protocol-specific risks
- Include detailed comments for complex logic
- Test all possible scenarios thoroughly

### 5. Example Protocol Integration

For example protocol integration, refer to the [Mock Strategy](./contracts/mocks/MockStrategy.sol) and [Mock Vault Factory](./contracts/mocks/MockVaultFactory.sol).

---

## Contracts

### Controller.sol

Manages the interaction between the Vault and the Strategy.

- **Key Functions**:
  - `setVault`: Associates a Vault with an asset.
  - `approveStrategy`: Approves a Strategy for an asset.
  - `setStrategy`: Sets the active Strategy.
  - `earn`: Transfers assets from the Vault to the Strategy.

### Vault.sol

Handles user deposits and withdrawals.

- **Key Functions**:
  - `deposit`: Users deposit assets and receive Vault shares.
  - `withdraw`: Users redeem Vault shares for assets.
  - `earn`: Initiates the process of transferring assets to the Strategy.
  - `balance`: Returns the total balance managed by the Vault.

### StrategyBase.sol

Abstract base contract for Strategies.

- **Key Functions**:
  - `deposit`: Deposits assets into the yield-generating platform.
  - `withdraw`: Withdraws assets from the platform.
  - `harvest`: Compounds rewards.

### VaultFactoryBase.sol

An abstract base contract that facilitates the creation of new Vaults, Controllers, and Strategies.

- **Key Functions**:
  - `createVault`: Deploys and sets up a new Vault along with its Controller and Strategy.
  - `_deployStrategyByteCode`: Deploys a Strategy using provided bytecode.

### SwapRouter.sol

Handles token swaps across different decentralized exchanges (DEXes).

- **Supported DEXes**:

  - Uniswap V2 & V3
  - Sushiswap V2 & V3
  - Camelot V3

- **Key Functions**:
  - `swap`: Swaps tokens using the specified DEX.
  - `getQuoteV3`: Retrieves a quote for a token swap on Uniswap V3 or Sushiswap V3.

### ZapperBase.sol

An abstract base contract that facilitates the creation of protocol-specific Zappers that handle token conversions and vault interactions.

- **Key Functions**:
  - `zapIn`: Converts and deposits a token into a vault
  - `zapInETH`: Converts and deposits ETH into a vault
  - `zapOutAndSwap`: Withdraws from a vault and converts to desired token
  - `zapOutAndSwapEth`: Withdraws from a vault and converts to ETH
- **Key Features**:
  - Whitelisted vault management
  - Dust token return handling
  - Native ETH wrapping/unwrapping
  - Governance controls
  - Swap router integration

---

## Deployment Guide

There are two ways to deploy Contrax vaults: manual deployment or using the VaultFactory.

### Manual Vault Setup Steps

1. **Deploy Controller** with:
   - `governance`, `timelock`, `strategist`, `devfund`, `treasury` addresses.
2. **Deploy Strategy** with:
   - `asset` (token address), `governance`, `timelock`, `strategist`, `controller`.
3. **Deploy Vault** with:
   - `asset` (token address), `governance`, `timelock`, `controller`.
4. **Controller Setup**:
   - Set Vault against asset: `setVault(asset, VaultAddress)`.
   - Approve Strategy: `approveStrategy(asset, StrategyAddress)`.
   - Set Strategy: `setStrategy(asset, StrategyAddress)`.

### Factory Deployment Steps

1. **Deploy VaultFactory** with:

   - `governance` address - This account will have permission to create new vaults.

2. **Create Strategy and Vault Factory**:

   - Create a new strategy contract that implements the `StrategyBase` interface.
   - Create a new vault factory contract that implements the `VaultFactoryBase` interface.
   - Create a createVault function in the vault factory contract to create protocol-specific vaults with custom parameters.

3. **Create Vault** by calling `createVault` with:

   ```solidity
   createVault(
     address _token,            // Asset token address
     address _governance,       // Governance address for vault/strategy
     address _strategist,       // Strategist address
     address _timelock,         // Timelock address
     address _devfund,         // Developer fund address
     address _treasury,         // Treasury address
     address _stakingAddress    // Staking address for new protocol vaults
   )
   ```

   Alternatively, you can use the factory's default createVault function with new strategy bytecode and constructor params:
   NOTE: This is only added for convenience in case the protocol strategy has to be updated.

   ```solidity
   createVault(
     address _token,            // Asset token address
     address _governance,       // Governance address for vault/strategy
     address _strategist,       // Strategist address
     address _timelock,         // Timelock address
     address _devfund,         // Developer fund address
     address _treasury,         // Treasury address
     bytes memory strategyCode, // Strategy contract bytecode
     bytes memory extraParams   // Additional strategy parameters
   )
   ```

4. **Verify Deployment**:
   - Check vault address: `vaults[tokenAddress]`
   - Check controller: `controllers[vaultAddress]`
   - Check strategy: `strategies[vaultAddress]`

The factory deployment method automatically:

- Creates and connects all components (Vault, Controller, Strategy)
- Sets up proper permissions
- Emits a `VaultCreated` event with deployment details

**Note**: Only the governance address can create new vaults through the factory.

---

## Security Considerations

- **Access Control**: Only authorized accounts (governance, strategist, timelock) can perform critical operations.
- **Token Safety**: The Controller cannot withdraw assets from the Strategy, ensuring funds are only moved when necessary.
- **Emergency Functions**: The `execute` function in Controller and Strategy allows for emergency actions via delegate calls, controlled by the timelock.

---

## Notes

- **Balance Calculation**: When calculating the pool balance, only the Vault and Strategy asset balances are considered.
- **Earning Yield**: The `earn` function can be called by anyone to initiate staking of assets.
- **Harvest Timing**: Harvesting is typically done every 24 hours. Users can potentially game the system by depositing and calling `earn` right before harvest to gain a larger share of the day's rewards.
- **Assets**: These are often LP or staked tokens from other platforms, representing a user's stake in an external pool.

---

## Conclusion

Contrax provides a robust and flexible way for users to maximize their yield through automated strategies and efficient asset management. By abstracting the complexities of yield farming, it offers an accessible platform for both novice and experienced users.

---

**For more information or assistance, please refer to the individual contract documentation or reach out to the development team.**

---

