// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IController {
  function treasury() external view returns (address);

  function devfund() external view returns (address);

  function strategist() external view returns (address);

  function governance() external view returns (address);

  function timelock() external view returns (address);

  function vaults(address) external view returns (address);

  function strategies(address) external view returns (address);

  function approvedStrategies(address, address) external view returns (bool);

  function balanceOf(address) external view returns (uint256);

  function withdraw(address, uint256) external;

  function earn(address, uint256) external;

  function setVault(address _token, address _vault) external;

  function approveStrategy(address _token, address _strategy) external;

  function revokeStrategy(address _token, address _strategy) external;

  function setStrategy(address _token, address _strategy) external;

  function setStrategist(address _strategist) external;

  function setGovernance(address _governance) external;

  function setTimelock(address _timelock) external;
}
