// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockStrategyExecute {
  function write(address _token, uint256 _amount) public {
    IERC20(_token).transfer(msg.sender, _amount);
  }
}
