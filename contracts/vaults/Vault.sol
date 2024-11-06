// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IController} from "../interfaces/IController.sol";
import {IVault} from "../interfaces/IVault.sol";

// TODO: Convert to ERC4626 Vault
contract Vault is ERC20, IVault {
  using SafeERC20 for IERC20;
  using Address for address;

  IERC20 public immutable token;

  uint256 public min = 9500;
  uint256 public constant max = 10000;

  address public governance;
  address public timelock;
  address public controller;

  constructor(
    address _token,
    address _governance,
    address _timelock,
    address _controller
  )
    ERC20(
      string(abi.encodePacked("Contrax Vault ", ERC20(_token).name())),
      string(abi.encodePacked("ctx", ERC20(_token).symbol()))
    )
  {
    token = IERC20(_token);
    governance = _governance;
    timelock = _timelock;
    controller = _controller;
  }

  function decimals() public view override(ERC20, IERC20Metadata) returns (uint8) {
    return ERC20(address(token)).decimals();
  }

  function balance() public view returns (uint256) {
    return token.balanceOf(address(this)) + IController(controller).balanceOf(address(token));
  }

  function setMin(uint256 _min) external {
    require(msg.sender == governance, "!governance");
    require(_min <= max, "numerator cannot be greater than denominator");
    min = _min;
  }

  function setGovernance(address _governance) public {
    require(msg.sender == governance, "!governance");
    governance = _governance;
  }

  function setTimelock(address _timelock) public {
    require(msg.sender == timelock, "!timelock");
    timelock = _timelock;
  }

  function setController(address _controller) public {
    require(msg.sender == timelock, "!timelock");
    controller = _controller;
  }

  // Custom logic in here for how much the vault allows to be borrowed
  // Sets minimum required on-hand to keep small withdrawals cheap
  function available() public view returns (uint256) {
    return (token.balanceOf(address(this)) * min) / max;
  }

  function earn() public {
    uint256 _bal = available();
    token.safeTransfer(controller, _bal);
    IController(controller).earn(address(token), _bal);
  }

  function depositAll() external {
    deposit(token.balanceOf(msg.sender));
  }

  // Declare a Deposit Event
  event Deposit(address indexed _from, uint _timestamp, uint _value, uint _shares);

  function deposit(uint256 _amount) public {
    uint256 _pool = balance();
    uint256 _before = token.balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), _amount);
    uint256 _after = token.balanceOf(address(this));
    _amount = _after - _before; // Additional check for deflationary tokens
    uint256 shares = 0;
    if (totalSupply() == 0) {
      shares = _amount;
    } else {
      shares = (_amount * totalSupply()) / _pool;
    }
    _mint(msg.sender, shares);

    emit Deposit(tx.origin, block.timestamp, _amount, shares);
  }

  function withdrawAll() external {
    withdraw(balanceOf(msg.sender));
  }

  // Used to swap any borrowed reserve over the debt limit to liquidate to 'token'
  function harvest(address reserve, uint256 amount) external {
    require(msg.sender == controller, "!controller");
    require(reserve != address(token), "token");
    IERC20(reserve).safeTransfer(controller, amount);
  }

  // Declare a Withdraw Event
  event Withdraw(address indexed _from, uint _timestamp, uint _value, uint _shares);

  // No rebalance implementation for lower fees and faster swaps
  function withdraw(uint256 _shares) public {
    uint256 amountToWithdraw = (balance() * _shares) / totalSupply();
    _burn(msg.sender, _shares);

    // Check balance
    uint256 vaultBalance = token.balanceOf(address(this));
    if (vaultBalance < amountToWithdraw) {
      uint256 _withdraw = amountToWithdraw - vaultBalance;
      IController(controller).withdraw(address(token), _withdraw);
      uint256 _after = token.balanceOf(address(this));
      uint256 _diff = _after - vaultBalance;
      if (_diff < _withdraw) {
        amountToWithdraw = vaultBalance + _diff;
      }
    }

    token.safeTransfer(msg.sender, amountToWithdraw);
    emit Withdraw(tx.origin, block.timestamp, amountToWithdraw, _shares);
  }

  function getRatio() public view returns (uint256) {
    return (balance() * 1e18) / totalSupply();
  }
}
