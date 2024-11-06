// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VaultFactoryBase} from "../factories/VaultFactoryBase.sol";
import {MockStrategy} from "./MockStrategy.sol";
import {IVault} from "../interfaces/IVault.sol";
import {IStrategy} from "../interfaces/IStrategy.sol";
import {IController} from "../interfaces/IController.sol";

contract MockVaultFactory is VaultFactoryBase {
  constructor(address _governance) VaultFactoryBase(_governance) {}

  function createVault(
    address _token,
    address _governance,
    address _strategist,
    address _timelock,
    address _devfund,
    address _treasury,
    address _staking
  )
    external
    virtual
    onlyGovernance
    onlyNewAsset(_token)
    returns (IVault vault, IController controller, IStrategy strategy)
  {
    // 1. create controller and vault
    (controller, vault) = _createControllerAndVault(_token, _governance, _strategist, _timelock, _devfund, _treasury);

    // 2. create strategy
    strategy = new MockStrategy(_token, _governance, _strategist, address(controller), _timelock, _staking);

    // 3. setup vault
    _setupVault(_token, vault, strategy, controller, _governance, _timelock);
    emit VaultCreated(_token, address(vault), address(strategy), address(controller), block.timestamp);
  }
}
