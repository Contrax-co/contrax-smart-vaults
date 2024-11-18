// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISwapRouter} from "../interfaces/ISwapRouter.sol";
import {MockERC20} from "./MockERC20.sol";

contract MockSwapRouter is ISwapRouter {
  address public immutable wrappedNative;

  constructor(address _wrappedNative) {
    require(_wrappedNative != address(0), "Invalid wrapped native address");
    wrappedNative = _wrappedNative;
  }

  function swap(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOutMinimum,
    address recipient
  ) external returns (uint256 amountOut) {
    // Burn input tokens
    MockERC20(tokenIn).burnFrom(msg.sender, amountIn);

    amountOut = amountIn;
    require(amountOut >= amountOutMinimum, "Insufficient output amount");

    // Mint output tokens
    MockERC20(tokenOut).mint(recipient, amountOut);

    return amountOut;
  }

  function swap(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOutMinimum,
    address recipient,
    DexType
  ) external returns (uint256 amountOut) {
    // Ignore dex parameter in mock, just use default swap
    return this.swap(tokenIn, tokenOut, amountIn, amountOutMinimum, recipient);
  }

  function swapWithPath(
    address[] calldata path,
    uint256 amountIn,
    uint256 amountOutMinimum,
    address recipient
  ) external returns (uint256 amountOut) {
    require(path.length >= 2, "Invalid path length");

    // Burn input tokens
    MockERC20(path[0]).burnFrom(msg.sender, amountIn);

    amountOut = amountIn;
    require(amountOut >= amountOutMinimum, "Insufficient output amount");

    // Mint output tokens to recipient
    MockERC20(path[path.length - 1]).mint(recipient, amountOut);

    return amountOut;
  }

  function swapWithPath(
    address[] calldata path,
    uint256 amountIn,
    uint256 amountOutMinimum,
    address recipient,
    DexType
  ) external returns (uint256 amountOut) {
    // Ignore dex parameter in mock, just use default swapWithPath
    return this.swapWithPath(path, amountIn, amountOutMinimum, recipient);
  }

  function getQuoteV3(address, address, uint256 amountIn, DexType) external pure returns (uint256) {
    return amountIn;
  }

  function getQuoteV3WithPath(address[] memory, uint256 amountIn, DexType) external pure returns (uint256) {
    return amountIn;
  }

  function v2Router(uint8) external view override returns (address) {
    return address(this);
  }

  function v3Router(uint8) external view override returns (address) {
    return address(this);
  }

  function v3Factory(uint8) external view override returns (address) {
    return address(this);
  }
}
