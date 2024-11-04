// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Vault} from "../vaults/Vault.sol";
import {Controller} from "../controllers/Controller.sol";
import {IVault} from "../interfaces/IVault.sol";
import {IStrategy} from "../interfaces/IStrategy.sol";
import {IController} from "../interfaces/IController.sol";
import {IVaultFactory} from "../interfaces/IVaultFactory.sol";

abstract contract VaultFactoryBase is IVaultFactory {
    mapping(address token => address vault) public vaults;
    mapping(address vault => address controller) public controllers;
    mapping(address vault => address strategy) public strategies;

    address public governance;

    constructor(address _governance) {
        governance = _governance;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "Caller is not the governance");
        _;
    }

    function setGovernance(address _governance) external onlyGovernance {
        governance = _governance;
    }

    function _createVault(
        address _token,
        IStrategy _strategy,
        IController _controller,
        address _governance,
        address _timelock
    )
        internal
        returns (IVault vault, IController controller, IStrategy strategy)
    {
        vault = new Vault(_token, _governance, _timelock, address(_controller));
        vaults[_token] = address(vault);
        controllers[address(vault)] = address(_controller);
        strategies[address(vault)] = address(_strategy);

        // set vault and strategy in controller
        _controller.setVault(_token, address(vault));
        _controller.approveStrategy(_token, address(_strategy));
        _controller.setStrategy(_token, address(_strategy));

        _controller.setGovernance(_governance);
        _controller.setTimelock(_timelock);

        return (vault, controller, strategy);
    }

    function _createStrategy(
        address _token,
        address _controller,
        address _governance,
        address _strategist,
        address _timelock
    ) internal virtual returns (IStrategy);

    function createVault(
        address _token,
        address _governance,
        address _strategist,
        address _timelock,
        address _devfund,
        address _treasury
    )
        external
        onlyGovernance
        returns (IVault vault, IController controller, IStrategy strategy)
    {
        controller = new Controller(
            address(this), // use factory as governance so we can set it later
            _strategist,
            address(this),
            _devfund,
            _treasury
        );
        strategy = _createStrategy(
            _token,
            address(controller),
            _governance,
            _strategist,
            _timelock
        );
        return
            _createVault(_token, strategy, controller, _governance, _timelock);
    }

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
        onlyGovernance
        returns (IVault vault, IController controller, IStrategy strategy)
    {
        controller = new Controller(
            address(this), // use factory as governance so we can set it later
            _strategist,
            address(this),
            _devfund,
            _treasury
        );

        bytes memory bytecode = abi.encodePacked(
            strategyContractCode,
            abi.encode(
                _token,
                _governance,
                _strategist,
                address(controller),
                _timelock
            ),
            strategyExtraParams // Additional arbitrary parameters
        );
        address strategyAddress;
        assembly {
            strategyAddress := create(0, add(bytecode, 0x20), mload(bytecode))

            if iszero(extcodesize(strategyAddress)) {
                revert(0, 0)
            }
        }
        strategy = IStrategy(strategyAddress);
        require(strategy.want() == _token, "Invalid strategy bytecode");
        return
            _createVault(_token, strategy, controller, _governance, _timelock);
    }

    function setVaultData(
        address _token,
        address _vault,
        address _controller,
        address _strategy
    ) external onlyGovernance {
        vaults[_token] = _vault;
        controllers[_vault] = _controller;
        strategies[_vault] = _strategy;
    }
}
