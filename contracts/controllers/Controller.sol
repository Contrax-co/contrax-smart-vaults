// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IController} from "../interfaces/IController.sol";
import {IStrategy} from "../interfaces/IStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

contract Controller is IController {
  using SafeERC20 for IERC20;
  using Address for address;

  address public governance;
  address public strategist;
  address public devfund;
  address public treasury;
  address public timelock;

  mapping(address => address) public vaults; // takes lp address and returns associated vault
  mapping(address => address) public strategies; // takes lp and returns associated strategy
  mapping(address => mapping(address => bool)) public approvedStrategies;

  constructor(address _governance, address _strategist, address _timelock, address _devfund, address _treasury) {
    governance = _governance;
    strategist = _strategist;
    timelock = _timelock;
    devfund = _devfund;
    treasury = _treasury;
  }

  function setDevFund(address _devfund) public {
    require(msg.sender == governance, "!governance");
    devfund = _devfund;
  }

  function setTreasury(address _treasury) public {
    require(msg.sender == governance, "!governance");
    treasury = _treasury;
  }

  function setStrategist(address _strategist) public {
    require(msg.sender == governance, "!governance");
    strategist = _strategist;
  }

  function setGovernance(address _governance) public {
    require(msg.sender == governance, "!governance");
    governance = _governance;
  }

  function setTimelock(address _timelock) public {
    require(msg.sender == timelock, "!timelock");
    timelock = _timelock;
  }

  function setVault(address _token, address _vault) public {
    require(msg.sender == strategist || msg.sender == governance, "!strategist");
    require(vaults[_token] == address(0), "vault already set");
    vaults[_token] = _vault;
  }

  function approveStrategy(address _token, address _strategy) public {
    require(msg.sender == timelock, "!timelock");
    approvedStrategies[_token][_strategy] = true;
  }

  function revokeStrategy(address _token, address _strategy) public {
    require(msg.sender == governance, "!governance");
    require(strategies[_token] != _strategy, "cannot revoke active strategy");
    approvedStrategies[_token][_strategy] = false;
  }

  function setStrategy(address _token, address _strategy) public {
    require(msg.sender == strategist || msg.sender == governance, "!strategist");
    require(approvedStrategies[_token][_strategy] == true, "!approved");

    address _current = strategies[_token];
    if (_current != address(0)) {
      IStrategy(_current).withdrawAll();
    }
    strategies[_token] = _strategy;
  }

  function earn(address _token, uint256 _amount) public {
    address _strategy = strategies[_token];
    IERC20(_token).safeTransfer(_strategy, _amount);
    IStrategy(_strategy).deposit();
  }

  function balanceOf(address _token) external view returns (uint256) {
    return IStrategy(strategies[_token]).balanceOf();
  }

  function withdrawAll(address _token) public {
    require(msg.sender == strategist || msg.sender == governance, "!strategist");
    IStrategy(strategies[_token]).withdrawAll();
  }

  function inCaseTokensGetStuck(address _token, uint256 _amount) public {
    require(msg.sender == strategist || msg.sender == governance, "!governance");
    IERC20(_token).safeTransfer(msg.sender, _amount);
  }

  function inCaseStrategyTokenGetStuck(address _strategy, address _token) public {
    require(msg.sender == strategist || msg.sender == governance, "!governance");
    IStrategy(_strategy).withdraw(_token);
  }

  function withdraw(address _token, uint256 _amount) public {
    require(msg.sender == vaults[_token], "!vault");
    IStrategy(strategies[_token]).withdraw(_amount);
  }
}
