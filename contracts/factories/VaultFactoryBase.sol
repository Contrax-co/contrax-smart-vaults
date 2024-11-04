// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Vault} from "../vaults/Vault.sol";
import {Controller} from "../controllers/Controller.sol";
import {IStrategy} from "../interfaces/IStrategy.sol";

abstract contract VaultFactoryBase {
    mapping(address token => address vault) public vaults;
    mapping(address vault => address controller) public controllers;
    mapping(address vault => address strategy) public strategies;

    address public governance;

    modifier onlyGovernance() {
        require(msg.sender == governance, "Caller is not the governance");
        _;
    }

    function _createVault(
        address _token,
        IStrategy _strategy,
        Controller _controller,
        address _governance,
        address _timelock
    ) internal {
        Vault vault = new Vault(
            _token,
            _governance,
            _timelock,
            address(_controller)
        );
        vaults[_token] = address(vault);
        controllers[address(vault)] = address(_controller);
        strategies[address(vault)] = address(_strategy);

        // set vault and strategy in controller
        _controller.setVault(_token, address(vault));
        _controller.approveStrategy(_token, address(_strategy));
        _controller.setStrategy(_token, address(_strategy));

        _controller.setGovernance(msg.sender);
        _controller.setTimelock(msg.sender);
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
    ) external onlyGovernance {
        Controller controller = new Controller(
            address(this), // use factory as governance so we can set it later
            _strategist,
            address(this),
            _devfund,
            _treasury
        );
        IStrategy strategy = _createStrategy(
            _token,
            address(controller),
            _governance,
            _strategist,
            _timelock
        );
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
    ) external onlyGovernance {
        Controller controller = new Controller(
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
        IStrategy strategy = IStrategy(strategyAddress);
        require(strategy.want() == _token, "Invalid strategy bytecode");
        _createVault(_token, strategy, controller, _governance, _timelock);
    }
}
