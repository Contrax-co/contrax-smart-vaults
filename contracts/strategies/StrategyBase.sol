// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IStrategy} from "../interfaces/IStrategy.sol";
import {IController} from "../interfaces/IController.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

abstract contract StrategyBase is IStrategy {
    using SafeERC20 for IERC20;
    using Address for address;

    // Tokens
    IERC20 public want;
    uint24 public constant poolFee = 3000;

    // Perfomance fees - start with 10%
    uint256 public performanceTreasuryFee = 1000;
    uint256 public constant performanceTreasuryMax = 10000;

    uint256 public performanceDevFee = 0;
    uint256 public constant performanceDevMax = 10000;

    uint256 public withdrawalTreasuryFee = 0;
    uint256 public constant withdrawalTreasuryMax = 100000;

    uint256 public withdrawalDevFundFee = 0;
    uint256 public constant withdrawalDevFundMax = 100000;

    // User accounts
    address public governance;
    address public controller;
    address public strategist;
    address public timelock;

    mapping(address => bool) public harvesters;

    constructor(
        address _want,
        address _governance,
        address _strategist,
        address _controller,
        address _timelock
    ) {
        require(
            _want != address(0) &&
                _governance != address(0) &&
                _strategist != address(0) &&
                _controller != address(0) &&
                _timelock != address(0),
            "One or more addresses are invalid"
        );

        want = IERC20(_want);
        governance = _governance;
        strategist = _strategist;
        controller = _controller;
        timelock = _timelock;
    }

    // **** Modifiers **** //

    modifier onlyBenevolent() {
        require(
            harvesters[msg.sender] ||
                msg.sender == governance ||
                msg.sender == strategist,
            "Only Benevolent"
        );
        _;
    }

    modifier onlyController() {
        require(msg.sender == controller, "Only Controller");
        _;
    }

    modifier onlyTimelock() {
        require(msg.sender == timelock, "Only Timelock");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "Only Governance");
        _;
    }

    // **** Views **** //

    function balanceOfWant() public view returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    function balanceOfPool() public view virtual returns (uint256);

    function balanceOf() public view returns (uint256) {
        return balanceOfWant() + balanceOfPool();
    }

    // **** Setters **** //

    function whitelistHarvester(address _harvester) external {
        require(
            msg.sender == governance ||
                msg.sender == strategist ||
                harvesters[msg.sender],
            "not authorized"
        );
        harvesters[_harvester] = true;
    }

    function revokeHarvester(address _harvester) external {
        require(
            msg.sender == governance || msg.sender == strategist,
            "not authorized"
        );
        harvesters[_harvester] = false;
    }

    function setWithdrawalDevFundFee(
        uint256 _withdrawalDevFundFee
    ) external onlyTimelock {
        withdrawalDevFundFee = _withdrawalDevFundFee;
    }

    function setWithdrawalTreasuryFee(
        uint256 _withdrawalTreasuryFee
    ) external onlyTimelock {
        withdrawalTreasuryFee = _withdrawalTreasuryFee;
    }

    function setPerformanceDevFee(
        uint256 _performanceDevFee
    ) external onlyTimelock {
        performanceDevFee = _performanceDevFee;
    }

    function setPerformanceTreasuryFee(
        uint256 _performanceTreasuryFee
    ) external onlyTimelock {
        performanceTreasuryFee = _performanceTreasuryFee;
    }

    function setStrategist(address _strategist) external onlyGovernance {
        strategist = _strategist;
    }

    function setGovernance(address _governance) external onlyGovernance {
        governance = _governance;
    }

    function setTimelock(address _timelock) external onlyTimelock {
        timelock = _timelock;
    }

    function setController(address _controller) external onlyTimelock {
        controller = _controller;
    }

    // **** State mutations **** //
    function deposit() public virtual;

    function harvest() public virtual;

    function _withdrawSome(uint256 _amount) internal virtual returns (uint256);

    // Controller only function for creating additional rewards from dust
    function withdraw(
        address _asset
    ) external onlyController returns (uint256 balance) {
        require(address(want) != address(_asset), "want");
        balance = IERC20(_asset).balanceOf(address(this));
        IERC20(_asset).safeTransfer(controller, balance);
    }

    // Withdraw partial funds, normally used with a vault withdrawal
    function withdraw(uint256 _amount) external onlyController {
        uint256 _balance = IERC20(want).balanceOf(address(this));
        if (_balance < _amount) {
            _amount = _withdrawSome(_amount - _balance);
            _amount = _amount + _balance;
        }

        uint256 _feeDev = (_amount * withdrawalDevFundFee) /
            withdrawalDevFundMax;
        IERC20(want).safeTransfer(IController(controller).devfund(), _feeDev);

        uint256 _feeTreasury = (_amount * withdrawalTreasuryFee) /
            withdrawalTreasuryMax;
        IERC20(want).safeTransfer(
            IController(controller).treasury(),
            _feeTreasury
        );

        address _vault = IController(controller).vaults(address(want));
        require(_vault != address(0), "!vault"); // additional protection so we don't burn the funds

        IERC20(want).safeTransfer(_vault, _amount - _feeDev - _feeTreasury);
    }

    // Withdraw funds, used to swap between strategies
    function withdrawForSwap(
        uint256 _amount
    ) external onlyController returns (uint256 balance) {
        _withdrawSome(_amount);

        balance = IERC20(want).balanceOf(address(this));

        address _vault = IController(controller).vaults(address(want));
        require(_vault != address(0), "!vault");
        IERC20(want).safeTransfer(_vault, balance);
    }

    // Withdraw all funds, normally used when migrating strategies
    function withdrawAll() external onlyController returns (uint256 balance) {
        _withdrawAll();

        balance = IERC20(want).balanceOf(address(this));

        address _vault = IController(controller).vaults(address(want));
        require(_vault != address(0), "!vault"); // additional protection so we don't burn the funds
        IERC20(want).safeTransfer(_vault, balance);
    }

    function _withdrawAll() internal {
        _withdrawSome(balanceOfPool());
    }

    // **** Emergency functions ****

    function execute(
        address _target,
        bytes memory _data
    ) public payable onlyTimelock returns (bytes memory response) {
        require(_target != address(0), "!target");

        // call contract in current context
        assembly {
            let succeeded := delegatecall(
                sub(gas(), 5000),
                _target,
                add(_data, 0x20),
                mload(_data),
                0,
                0
            )
            let size := returndatasize()

            response := mload(0x40)
            mstore(
                0x40,
                add(response, and(add(add(size, 0x20), 0x1f), not(0x1f)))
            )
            mstore(response, size)
            returndatacopy(add(response, 0x20), 0, size)

            switch iszero(succeeded)
            case 1 {
                // throw if delegatecall failed
                revert(add(response, 0x20), size)
            }
        }
    }

    function _distributePerformanceFeesAndDeposit() internal {
        uint256 _want = IERC20(want).balanceOf(address(this));

        if (_want > 0) {
            // Treasury fees
            IERC20(want).safeTransfer(
                IController(controller).treasury(),
                (_want * performanceTreasuryFee) / performanceTreasuryMax
            );

            // Performance fee
            IERC20(want).safeTransfer(
                IController(controller).devfund(),
                (_want * performanceDevFee) / performanceDevMax
            );

            deposit();
        }
    }

    function _distributePerformanceFeesBasedAmountAndDeposit(
        uint256 _amount
    ) internal {
        uint256 _want = IERC20(want).balanceOf(address(this));

        if (_amount > _want) {
            _amount = _want;
        }

        if (_amount > 0) {
            // Treasury fees
            IERC20(want).safeTransfer(
                IController(controller).treasury(),
                (_amount * performanceTreasuryFee) / performanceTreasuryMax
            );

            // Performance fee
            IERC20(want).safeTransfer(
                IController(controller).devfund(),
                (_amount * performanceDevFee) / performanceDevMax
            );

            deposit();
        }
    }
}
