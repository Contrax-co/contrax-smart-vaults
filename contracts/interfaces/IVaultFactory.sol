// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IVault} from "../interfaces/IVault.sol";
import {IStrategy} from "../interfaces/IStrategy.sol";
import {IController} from "../interfaces/IController.sol";

interface IVaultFactory {
    function governance() external view returns (address);

    function vaults(address token) external view returns (address);

    function controllers(address vault) external view returns (address);

    function strategies(address vault) external view returns (address);

    function createVault(
        address _token,
        address _governance,
        address _strategist,
        address _timelock,
        address _devfund,
        address _treasury,
        bytes memory strategyContractCode,
        bytes memory strategyExtraParams
    )
        external
        returns (IVault vault, IController controller, IStrategy strategy);
}
