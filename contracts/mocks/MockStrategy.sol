// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StrategyBase} from "../strategies/StrategyBase.sol";
import {IMockStaking} from "./IMockStaking.sol";

contract MockStrategy is StrategyBase {
  IMockStaking public staking;

  constructor(
    address _want,
    address _governance,
    address _strategist,
    address _controller,
    address _timelock,
    address _staking
  ) StrategyBase(_want, _governance, _strategist, _controller, _timelock) {
    staking = IMockStaking(_staking);
  }

  function deposit() public override {
    uint256 amount = want.balanceOf(address(this));
    want.approve(address(staking), amount);
    staking.deposit(amount, address(this));
  }

  function getHarvestable() external view override returns (address reward, uint256 amount) {
    return (address(staking.rewardToken()), staking.earned(address(this)));
  }

  function harvest() public override {
    staking.getReward();
  }

  function balanceOfPool() public view virtual override returns (uint256) {
    return IERC20(address(staking)).balanceOf(address(this));
  }

  function _withdrawSome(uint256 _amount) internal virtual override returns (uint256) {
    return staking.withdraw(_amount, address(this), address(this));
  }
}