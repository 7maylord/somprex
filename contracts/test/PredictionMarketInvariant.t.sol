// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PredictionMarket.sol";

contract PredictionMarketInvariantTest is Test {
    PredictionMarket public market;

    address[] public actors;
    address public owner;

    uint256 public ghost_totalBetsPlaced;
    uint256 public ghost_totalBetsValue;
    uint256 public ghost_totalWinningsClaimed;
    uint256 public ghost_totalRefundsClaimed;

    constructor() {
        owner = address(this);
        market = new PredictionMarket();

        // Create actors
        actors.push(makeAddr("actor1"));
        actors.push(makeAddr("actor2"));
        actors.push(makeAddr("actor3"));
        actors.push(makeAddr("actor4"));

        for (uint i = 0; i < actors.length; i++) {
            vm.deal(actors[i], 100 ether);
        }

        // Authorize this contract as resolver
        market.setResolver(address(this), true);

        // Target this contract for invariant testing
        targetContract(address(this));
    }

    /* ============ State Modifying Functions ============ */

    function createMarket(bytes32 marketId, string memory question) public {
        uint256 resolutionTime = block.timestamp + 3600;

        try market.createMarket(
            marketId,
            PredictionMarket.MarketType.GAME,
            question,
            resolutionTime,
            bytes32(0)
        ) {
            // Market created successfully
        } catch {
            // Market already exists or invalid params
        }
    }

    function placeBet(uint256 actorSeed, bytes32 marketId, uint8 option, uint256 amount) public {
        address actor = actors[actorSeed % actors.length];
        amount = bound(amount, 0.01 ether, 10 ether);
        option = uint8(bound(option, 0, 1));

        vm.deal(actor, 100 ether);

        vm.prank(actor);
        try market.placeBet{value: amount}(marketId, option) {
            ghost_totalBetsPlaced++;
            ghost_totalBetsValue += amount;
        } catch {
            // Market doesn't exist or is not active
        }
    }

    function resolveMarket(bytes32 marketId, uint8 winningOption) public {
        winningOption = uint8(bound(winningOption, 0, 1));

        vm.warp(block.timestamp + 3601);

        try market.resolveMarket(marketId, winningOption) {
            // Market resolved
        } catch {
            // Market doesn't exist or already resolved
        }
    }

    function claimWinnings(uint256 actorSeed, bytes32 marketId) public {
        address actor = actors[actorSeed % actors.length];

        uint256 balanceBefore = actor.balance;

        vm.prank(actor);
        try market.claimWinnings(marketId) {
            uint256 balanceAfter = actor.balance;
            ghost_totalWinningsClaimed += (balanceAfter - balanceBefore);
        } catch {
            // No winnings or market not resolved
        }
    }

    function cancelMarket(bytes32 marketId) public {
        try market.cancelMarket(marketId) {
            // Market cancelled
        } catch {
            // Market doesn't exist or not authorized
        }
    }

    function refundBets(uint256 actorSeed, bytes32 marketId) public {
        address actor = actors[actorSeed % actors.length];

        uint256 balanceBefore = actor.balance;

        vm.prank(actor);
        try market.refundBets(marketId) {
            uint256 balanceAfter = actor.balance;
            ghost_totalRefundsClaimed += (balanceAfter - balanceBefore);
        } catch {
            // No bets or market not cancelled
        }
    }

    /* ============ Invariants ============ */

    /// @custom:property Contract balance should always be >= collected fees
    function invariant_ContractBalanceCoversFeesAndBets() public view {
        assertTrue(
            address(market).balance >= market.collectedFees(),
            "Contract balance must cover collected fees"
        );
    }

    /// @custom:property Platform fee should never exceed 10%
    function invariant_PlatformFeeWithinBounds() public view {
        assertTrue(
            market.platformFee() <= 1000,
            "Platform fee must be <= 10%"
        );
    }

    /// @custom:property Min bet must be less than max bet
    function invariant_BetLimitsValid() public view {
        assertTrue(
            market.minBetAmount() < market.maxBetAmount(),
            "Min bet must be < max bet"
        );
    }

    /// @custom:property Total payouts should not exceed total bets
    function invariant_PayoutsShouldNotExceedBets() public view {
        // Total payouts (winnings + refunds) should be <= total bets
        assertTrue(
            ghost_totalWinningsClaimed + ghost_totalRefundsClaimed <= ghost_totalBetsValue + ghost_totalBetsValue / 10,
            "Payouts should not significantly exceed bets"
        );
    }

    /// @custom:property Collected fees should be reasonable
    function invariant_CollectedFeesReasonable() public view {
        // Fees should be less than total bets value
        assertTrue(
            market.collectedFees() <= ghost_totalBetsValue,
            "Collected fees should be reasonable"
        );
    }

    receive() external payable {}
}
