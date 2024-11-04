// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VaultFactoryBase} from "./VaultFactoryBase.sol";
import {GammaStrategy} from "../strategies/GammaStrategy.sol";
import {IStrategy} from "../interfaces/IStrategy.sol";

contract GammaVaultFactory is VaultFactoryBase {
    function _createStrategy(
        address _token,
        address _controller,
        address _governance,
        address _strategist,
        address _timelock
    ) internal override returns (IStrategy) {
        return
            new GammaStrategy(
                _token,
                _governance,
                _strategist,
                _controller,
                _timelock
            );
    }
}
