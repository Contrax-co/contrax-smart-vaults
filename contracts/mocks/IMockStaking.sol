// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMockStaking {
  function rewardToken() external view returns (address);

  function earned(address account) external view returns (uint256);

  function getReward() external;

  function deposit(uint256 assets, address receiver) external returns (uint256 shares);

  function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
}