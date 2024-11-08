// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStrategy {
  event Harvest(uint256 timestamp, uint256 amount);

  function want() external view returns (IERC20);

  function timelock() external view returns (address);

  function governance() external view returns (address);

  function strategist() external view returns (address);

  function controller() external view returns (address);

  function deposit() external;

  function withdrawForSwap(uint256) external returns (uint256);

  function withdraw(uint256) external;

  function withdraw(address) external returns (uint256);

  function withdrawAll() external returns (uint256);

  function balanceOf() external view returns (uint256);

  function getHarvestable() external view returns (address reward, uint256 amount);

  function harvest() external;

  function setTimelock(address) external;

  function setController(address _controller) external;

  function execute(address _target, bytes calldata _data) external payable returns (bytes memory response);
}
