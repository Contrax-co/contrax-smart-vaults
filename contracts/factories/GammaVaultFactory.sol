// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VaultFactoryBase} from "./VaultFactoryBase.sol";
import {GammaStrategy} from "../strategies/GammaStrategy.sol";
import {IStrategy} from "../interfaces/IStrategy.sol";
import {IVault} from "../interfaces/IVault.sol";
import {IStrategy} from "../interfaces/IStrategy.sol";
import {IController} from "../interfaces/IController.sol";

contract GammaVaultFactory is VaultFactoryBase {
  constructor(address _dev) VaultFactoryBase(_dev) {}

  function createVault(
    address _token,
    address _governance,
    address _strategist,
    address _timelock,
    address _devfund,
    address _treasury
  ) external virtual onlyDev onlyNewAsset(_token) returns (IVault vault, IController controller, IStrategy strategy) {
    // 1. create controller and vault
    (controller, vault) = _createControllerAndVault(_token, _governance, _strategist, _timelock, _devfund, _treasury);

    // 2. create strategy
    strategy = new GammaStrategy(_token, _governance, _strategist, address(controller), _timelock);

    // 3. setup vault
    _setupVault(_token, vault, strategy, controller, _governance, _timelock);

    emit VaultCreated(_token, address(vault), address(controller), address(strategy), block.timestamp);
  }
}
