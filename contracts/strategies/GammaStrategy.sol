// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StrategyBase} from "./StrategyBase.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GammaStrategy is StrategyBase {
  constructor(
    address _want,
    address _governance,
    address _strategist,
    address _controller,
    address _timelock
  ) StrategyBase(_want, _governance, _strategist, _controller, _timelock) {}

  function deposit() public override {
    // no need to deposit anything because we are not staking
  }

  function getHarvestable() external view override returns (address reward, uint256 amount) {
    // no need to harvest anything because we are not staking
  }

  function harvest() public override {
    // no need to harvest anything because we are not staking
  }

  function balanceOfPool() public view virtual override returns (uint256) {
    // no need to track any balance in the pool
    return 0;
  }

  function _withdrawSome(uint256 _amount) internal virtual override returns (uint256) {
    // no need to withdraw anything because we are not staking
    return _amount;
  }
}
