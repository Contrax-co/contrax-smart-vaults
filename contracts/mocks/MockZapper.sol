// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ZapperBase} from "../zappers/ZapperBase.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IVault} from "../interfaces/IVault.sol";
import {ISwapRouter} from "../interfaces/ISwapRouter.sol";

contract MockZapper is ZapperBase {
  using SafeERC20 for IERC20;

  constructor(
    address _governance,
    address _wrappedNative,
    address _usdcToken,
    address _swapRouter,
    address[] memory _vaultsToWhitelist
  ) ZapperBase(_governance, _wrappedNative, _usdcToken, _swapRouter, _vaultsToWhitelist) {}

  function _beforeDeposit(
    IVault vault,
    IERC20 tokenIn
  ) public virtual override returns (uint256 tokenOutAmount, ReturnedAsset[] memory returnedAssets) {
    address tokenOut = address(IVault(vault).token());
    uint256 tokenInAmount = tokenIn.balanceOf(address(this));

    if (tokenOut != address(tokenIn)) {
      tokenIn.safeTransfer(address(swapRouter), tokenInAmount);
      tokenOutAmount = swapRouter.swap(
        address(tokenIn),
        tokenOut,
        tokenInAmount,
        0,
        address(this),
        ISwapRouter.DexType.UNISWAP_V3
      );
    }

    address[] memory tokens = new address[](1);
    tokens[0] = address(tokenIn);
    returnedAssets = _returnAssets(tokens);
  }

  function _afterWithdraw(
    IVault vault,
    IERC20 desiredToken
  ) public virtual override returns (uint256 tokenOutAmount, ReturnedAsset[] memory returnedAssets) {
    IERC20 tokenIn = IVault(vault).token();
    uint256 tokenInAmount = tokenIn.balanceOf(address(this));

    if (address(tokenIn) != address(desiredToken)) {
      tokenIn.safeTransfer(address(swapRouter), tokenInAmount);
      tokenOutAmount = swapRouter.swap(
        address(tokenIn),
        address(desiredToken),
        tokenInAmount,
        0,
        address(this),
        ISwapRouter.DexType.UNISWAP_V3
      );
    }

    address[] memory tokens = new address[](2);
    tokens[0] = address(desiredToken);
    tokens[1] = address(tokenIn);
    returnedAssets = _returnAssets(tokens);
  }
}
