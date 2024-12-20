// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Vault} from "../vaults/Vault.sol";
import {Controller} from "../controllers/Controller.sol";
import {IVault} from "../interfaces/IVault.sol";
import {IStrategy} from "../interfaces/IStrategy.sol";
import {IController} from "../interfaces/IController.sol";
import {IVaultFactory} from "../interfaces/IVaultFactory.sol";

abstract contract VaultFactoryBase is IVaultFactory {
  mapping(address token => address vault) public vaults;
  mapping(address vault => address controller) public controllers;
  mapping(address vault => address strategy) public strategies;

  address public dev;

  constructor(address _dev) {
    dev = _dev;
  }

  modifier onlyDev() {
    require(msg.sender == dev, "!dev");
    _;
  }

  modifier onlyNewAsset(address asset) {
    require(vaults[asset] == address(0), "already exists");
    _;
  }

  function setDev(address _dev) external onlyDev {
    dev = _dev;
  }

  event VaultCreated(address indexed asset, address vault, address controller, address strategy, uint256 timestamp);

  function _createControllerAndVault(
    address _token,
    address _governance,
    address _strategist,
    address _timelock,
    address _devfund,
    address _treasury
  ) internal returns (IController controller, IVault vault) {
    // ?? should we just use one controller for all vaults? but setting up the vault needs governance and timelock
    // maybe factory becomes controller to manage all the vaults?
    controller = new Controller(
      address(this), // use factory as governance so we can set it later
      _strategist,
      address(this),
      _devfund,
      _treasury
    );

    vault = new Vault(_token, _governance, _timelock, address(controller));
  }

  function _setupVault(
    address _token,
    IVault _vault,
    IStrategy _strategy,
    IController _controller,
    address _governance,
    address _timelock
  ) internal {
    vaults[_token] = address(_vault);
    controllers[address(_vault)] = address(_controller);
    strategies[address(_vault)] = address(_strategy);

    // set vault and strategy in controller
    _controller.setVault(_token, address(_vault));
    _controller.approveStrategy(_token, address(_strategy));
    _controller.setStrategy(_token, address(_strategy));

    // set back the governance and timelock in controller
    _controller.setGovernance(_governance);
    _controller.setTimelock(_timelock);
  }

  function createVault(
    address _token,
    address _governance,
    address _strategist,
    address _timelock,
    address _devfund,
    address _treasury,
    bytes memory strategyContractCode,
    bytes memory strategyExtraParams
  ) external onlyDev onlyNewAsset(_token) returns (IVault vault, IController controller, IStrategy strategy) {
    (controller, vault) = _createControllerAndVault(_token, _governance, _strategist, _timelock, _devfund, _treasury);
    strategy = _deployStrategyByteCode(
      strategyContractCode,
      abi.encode(_token, _governance, _strategist, address(controller), _timelock),
      strategyExtraParams,
      _token
    );
    _setupVault(_token, vault, strategy, controller, _governance, _timelock);
    emit VaultCreated(_token, address(vault), address(strategy), address(controller), block.timestamp);
  }

  function _deployStrategyByteCode(
    bytes memory strategyContractCode,
    bytes memory encodedParams,
    bytes memory strategyExtraParams,
    address token
  ) internal returns (IStrategy strategy) {
    address strategyAddress;
    bytes memory bytecode = abi.encodePacked(
      strategyContractCode,
      encodedParams,
      strategyExtraParams // Additional arbitrary parameters
    );
    assembly {
      strategyAddress := create(0, add(bytecode, 0x20), mload(bytecode))

      if iszero(extcodesize(strategyAddress)) {
        revert(0, 0)
      }
    }
    strategy = IStrategy(strategyAddress);
    require(address(strategy.want()) == token, "bytecode");
  }

  function setVaultData(address _token, address _vault, address _controller, address _strategy) external onlyDev {
    vaults[_token] = _vault;
    controllers[_vault] = _controller;
    strategies[_vault] = _strategy;
  }
}
