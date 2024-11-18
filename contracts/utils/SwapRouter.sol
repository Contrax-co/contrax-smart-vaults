// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {UniswapRouterV2} from "../interfaces/exchange/UniswapV2.sol";
import {ICamelotRouterV3} from "../interfaces/exchange/UniswapV3.sol";
import {IUniswapV3Router} from "../interfaces/exchange/UniswapV3.sol";
import {IUniswapV3Factory} from "../interfaces/exchange/UniswapV3.sol";
import {IUniswapV3Pool} from "../interfaces/exchange/UniswapV3.sol";
import {ISwapRouter} from "../interfaces/ISwapRouter.sol";
import {OracleLibrary} from "../libraries/UniswapV3Oracle.sol";

// TODO: Make this proxy contract
contract SwapRouter is ISwapRouter {
  using SafeERC20 for IERC20;
  using Address for address;

  address public immutable wrappedNative;

  mapping(uint8 => address) public v2Router;
  mapping(uint8 => address) public v3Router;
  mapping(uint8 => address) public v3Factory;

  event SetV2Router(uint8 indexed dex, address router);
  event SetV3Router(uint8 indexed dex, address router);
  event SetV3Factory(uint8 indexed dex, address factory);

  constructor(
    address _wrappedNative,
    uint8[] memory v2DexIndex,
    address[] memory v2Routers,
    uint8[] memory v3DexIndex,
    address[] memory v3Routers,
    address[] memory v3Factories
  ) {
    wrappedNative = _wrappedNative;
    require(v2DexIndex.length == v2Routers.length, "invalid v2 router length");
    require(
      v3DexIndex.length == v3Routers.length && v3DexIndex.length == v3Factories.length,
      "invalid v3 router and factory length"
    );

    for (uint8 i = 0; i < v2DexIndex.length; i++) {
      v2Router[v2DexIndex[i]] = v2Routers[i];
      emit SetV2Router(v2DexIndex[i], v2Routers[i]);
    }
    for (uint8 i = 0; i < v3DexIndex.length; i++) {
      v3Router[v3DexIndex[i]] = v3Routers[i];
      emit SetV3Router(v3DexIndex[i], v3Routers[i]);
    }
    for (uint8 i = 0; i < v3DexIndex.length; i++) {
      v3Factory[v3DexIndex[i]] = v3Factories[i];
      emit SetV3Factory(v3DexIndex[i], v3Factories[i]);
    }
  }

  function setV2Router(uint8 dex, address router) external {
    v2Router[dex] = router;
    emit SetV2Router(dex, router);
  }

  function setV3Router(uint8 dex, address router) external {
    v3Router[dex] = router;
    emit SetV3Router(dex, router);
  }

  function setV3Factory(uint8 dex, address factory) external {
    v3Factory[dex] = factory;
    emit SetV3Factory(dex, factory);
  }

  function swap(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOutMinimum,
    address recipient
  ) external returns (uint256 amountOut) {
    return
      swap(
        tokenIn,
        tokenOut,
        amountIn,
        amountOutMinimum,
        recipient,
        DexType.UNISWAP_V3 // default to using uniswap v3
      );
  }

  function swap(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOutMinimum,
    address recipient,
    DexType dex
  ) public returns (uint256 amountOut) {
    address router;
    address factory;
    if (dex == DexType.UNISWAP_V3 || dex == DexType.SUSHISWAP_V3) {
      router = v3Router[uint8(dex)];
      factory = v3Factory[uint8(dex)];
      require(router != address(0), "v3 router not supported");
      require(factory != address(0), "v3 factory not supported");
      return swapV3(tokenIn, tokenOut, amountIn, amountOutMinimum, recipient, router, factory);
    } else if (dex == DexType.UNISWAP_V2 || dex == DexType.SUSHISWAP_V2) {
      router = v2Router[uint8(dex)];
      require(router != address(0), "v2 router not supported");
      return swapV2(tokenIn, tokenOut, amountIn, amountOutMinimum, recipient, router);
    } else if (dex == DexType.CAMELOT_V3) {
      router = v3Router[uint8(dex)];
      require(router != address(0), "v3 router not supported");
      return swapCamelotV3(tokenIn, tokenOut, amountIn, amountOutMinimum, recipient);
    }

    revert("unsupported dex type");
  }

  function swapWithPath(
    address[] calldata path,
    uint256 amountIn,
    uint256 amountOutMinimum,
    address recipient
  ) public returns (uint256 amountOut) {
    return
      swapWithPath(
        path,
        amountIn,
        amountOutMinimum,
        recipient,
        DexType.UNISWAP_V3 // default to using uniswap v3
      );
  }

  function swapWithPath(
    address[] calldata path,
    uint256 amountIn,
    uint256 amountOutMinimum,
    address recipient,
    DexType dex
  ) public returns (uint256 amountOut) {
    if (dex == DexType.UNISWAP_V3 || dex == DexType.SUSHISWAP_V3) {
      return swapV3WithPath(path, amountIn, amountOutMinimum, recipient, v3Router[uint8(dex)], v3Factory[uint8(dex)]);
    } else if (dex == DexType.UNISWAP_V2 || dex == DexType.SUSHISWAP_V2) {
      return swapV2WithPath(path, amountIn, amountOutMinimum, recipient, v2Router[uint8(dex)]);
    }

    revert("unsupported dex type");
  }

  /** Internal Functions */

  function findMostLiquidV3Pool(
    address tokenIn,
    address tokenOut,
    address factory
  ) public view returns (address bestPool, uint128 highestLiquidity) {
    uint24[4] memory fees = [uint24(500), uint24(3000), uint24(1000), uint24(10000)];

    for (uint256 i = 0; i < fees.length; i++) {
      address poolAddress = IUniswapV3Factory(factory).getPool(tokenIn, tokenOut, fees[i]);
      if (poolAddress != address(0)) {
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        uint128 liquidity = pool.liquidity();
        if (liquidity > highestLiquidity) {
          highestLiquidity = liquidity;
          bestPool = poolAddress;
        }
      }
    }
  }

  function swapV3(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOutMinimum,
    address recipient,
    address router,
    address factory
  ) internal returns (uint256 amountOut) {
    // first try to find the direct pool between tokenIn and tokenOut
    (address poolAddress, ) = findMostLiquidV3Pool(address(tokenIn), tokenOut, factory);
    IERC20(tokenIn).forceApprove(address(router), amountIn);
    if (poolAddress == address(0)) {
      // if no direct pool is found, try to find a pool between tokenIn and WETH and then between WETH and tokenOut
      address[] memory path = new address[](3);
      path[0] = tokenIn;
      path[1] = wrappedNative;
      path[2] = tokenOut;
      return swapV3WithPath(path, amountIn, amountOutMinimum, recipient, router, factory);
    } else {
      IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        fee: IUniswapV3Pool(poolAddress).fee(),
        recipient: recipient,
        deadline: block.timestamp,
        amountIn: amountIn,
        amountOutMinimum: amountOutMinimum,
        sqrtPriceLimitX96: 0
      });

      return IUniswapV3Router(router).exactInputSingle(params);
    }
  }

  function swapV3WithPath(
    address[] memory path,
    uint256 amountIn,
    uint256 amountOutMinimum,
    address recipient,
    address router,
    address factory
  ) internal returns (uint256 amountOut) {
    bytes memory pathBytes;
    for (uint256 i = 0; i < path.length - 2; i++) {
      (address poolAddress, ) = findMostLiquidV3Pool(address(path[i]), path[i + 1], factory);
      pathBytes = abi.encodePacked(pathBytes, path[i], IUniswapV3Pool(poolAddress).fee(), path[i + 1]);
      require(poolAddress != address(0), "No pool found for multihop swap");
    }
    IERC20(path[0]).forceApprove(address(router), amountIn);
    IUniswapV3Router.ExactInputParams memory params = IUniswapV3Router.ExactInputParams({
      path: pathBytes,
      recipient: recipient,
      deadline: block.timestamp,
      amountIn: amountIn,
      amountOutMinimum: amountOutMinimum
    });

    return IUniswapV3Router(router).exactInput(params);
  }

  function swapV2(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOutMinimum,
    address recipient,
    address router
  ) internal returns (uint256 amountOut) {
    require(tokenOut != address(0));

    address[] memory path;

    if (tokenIn == wrappedNative || tokenOut == wrappedNative) {
      path = new address[](2);
      path[0] = tokenIn;
      path[1] = tokenOut;
    } else {
      path = new address[](3);
      path[0] = tokenIn;
      path[1] = wrappedNative;
      path[2] = tokenOut;
    }

    IERC20(tokenIn).forceApprove(router, amountIn);
    uint256 balanceBefore = IERC20(tokenOut).balanceOf(recipient);
    UniswapRouterV2(router).swapExactTokensForTokens(amountIn, 0, path, recipient, block.timestamp);
    amountOut = IERC20(tokenOut).balanceOf(recipient) - balanceBefore;
    require(amountOut >= amountOutMinimum, "swapV2: amountOut < amountOutMinimum");
  }

  function swapV2WithPath(
    address[] memory path,
    uint256 amountIn,
    uint256 amountOutMinimum,
    address recipient,
    address router
  ) internal returns (uint256 amountOut) {
    require(path[1] != address(0));

    IERC20(path[0]).forceApprove(router, amountIn);
    uint256 balanceBefore = IERC20(path[path.length - 1]).balanceOf(recipient);
    UniswapRouterV2(router).swapExactTokensForTokens(amountIn, 0, path, recipient, block.timestamp);
    amountOut = IERC20(path[path.length - 1]).balanceOf(recipient) - balanceBefore;
    require(amountOut >= amountOutMinimum, "swapV2: amountOut < amountOutMinimum");
  }

  function swapCamelotV3(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOutMinimum,
    address recipient
  ) internal returns (uint256 amountOut) {
    IERC20(tokenIn).forceApprove(v3Router[uint8(DexType.CAMELOT_V3)], amountIn);
    ICamelotRouterV3.ExactInputSingleParams memory params = ICamelotRouterV3.ExactInputSingleParams({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      recipient: recipient,
      deadline: block.timestamp,
      amountIn: amountIn,
      amountOutMinimum: amountOutMinimum,
      sqrtPriceLimitX96: 0
    });
    return ICamelotRouterV3(v3Router[uint8(DexType.CAMELOT_V3)]).exactInputSingle(params);
  }

  function _getQuoteV3(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    address factory
  ) internal view returns (uint256 amountOut) {
    (address poolAddress, ) = findMostLiquidV3Pool(tokenIn, tokenOut, factory);

    if (poolAddress == address(0)) {
      // if no direct pool is found, try to find a pool between tokenIn and WETH and then between WETH and tokenOut
      address[] memory path = new address[](3);
      path[0] = tokenIn;
      path[1] = wrappedNative;
      path[2] = tokenOut;
      return _getQuoteV3WithPath(path, amountIn, factory);
    }

    IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
    (, int24 tick, , , , , ) = pool.slot0();

    // Call Oracle to get the price at the given tick
    amountOut = OracleLibrary.getQuoteAtTick(
      tick,
      uint128(amountIn), // Casting to uint128 since the library expects this type
      tokenIn,
      tokenOut
    );
  }

  function _getQuoteV3WithPath(
    address[] memory path,
    uint256 amountIn,
    address factory
  ) internal view returns (uint256 amountOut) {
    for (uint256 i = 0; i < path.length - 2; i++) {
      (address poolAddress, ) = findMostLiquidV3Pool(address(path[i]), path[i + 1], factory);

      require(poolAddress != address(0), "No pool found for multihop qoute");

      IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
      (, int24 tick, , , , , ) = pool.slot0();

      // Call Oracle to get the price at the given tick
      amountOut = OracleLibrary.getQuoteAtTick(
        tick,
        uint128(amountIn), // Casting to uint128 since the library expects this type
        path[i],
        path[i + 1]
      );
      // amount in is now the amount out of the last pool
      amountIn = amountOut;
    }
  }

  function getQuoteV3(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    DexType dex
  ) public view returns (uint256 amountOut) {
    address factory = v3Factory[uint8(dex)];
    require(factory != address(0), "unsupported dex type");
    return _getQuoteV3(tokenIn, tokenOut, amountIn, factory);
  }

  function getQuoteV3WithPath(
    address[] memory path,
    uint256 amountIn,
    DexType dex
  ) public view returns (uint256 amountOut) {
    address factory = v3Factory[uint8(dex)];
    require(factory != address(0), "unsupported dex type");
    return _getQuoteV3WithPath(path, amountIn, factory);
  }
}
