// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/PredictionMarket.sol";

contract PredictionMarketTest is Test {
    PredictionMarket public predictionMarket;

    address owner = address(1);
    address resolver = address(2);
    address creator = address(3);
    address bettor1 = address(4);
    address bettor2 = address(5);
    address bettor3 = address(6);
    address unauthorized = address(7);

    bytes32 marketId = keccak256("market1");
    bytes32 dataSourceId = keccak256("game-event-1");
    string question = "Will the player defeat the boss in under 60 seconds?";

    event MarketCreated(
        bytes32 indexed marketId,
        PredictionMarket.MarketType marketType,
        string question,
        address creator,
        bytes32 dataSourceId
    );

    event BetPlaced(
        bytes32 indexed marketId,
        address indexed bettor,
        uint8 option,
        uint256 amount,
        uint256 timestamp
    );

    event MarketResolved(
        bytes32 indexed marketId,
        uint8 winningOption,
        uint256 totalPool,
        uint256 timestamp
    );

    event WinningsClaimed(
        bytes32 indexed marketId,
        address indexed winner,
        uint256 amount
    );

    event MarketCancelled(bytes32 indexed marketId);

    event ResolverUpdated(address indexed resolver, bool authorized);

    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);

    event BetLimitsUpdated(uint256 minAmount, uint256 maxAmount);

    event FeesWithdrawn(address indexed owner, uint256 amount);

    function setUp() public {
        vm.startPrank(owner);
        predictionMarket = new PredictionMarket();
        predictionMarket.setResolver(resolver, true);
        vm.stopPrank();
    }

    /* ============ Deployment Tests ============ */

    function test_Deployment_OwnerIsSet() public {
        assertEq(predictionMarket.owner(), owner);
    }

    function test_Deployment_OwnerIsAuthorizedResolver() public {
        assertTrue(predictionMarket.authorizedResolvers(owner));
    }

    function test_Deployment_DefaultValues() public {
        assertEq(predictionMarket.platformFee(), 200); // 2%
        assertEq(predictionMarket.minBetAmount(), 0.01 ether);
        assertEq(predictionMarket.maxBetAmount(), 100 ether);
        assertEq(predictionMarket.collectedFees(), 0);
    }

    /* ============ Resolver Management Tests ============ */

    function test_SetResolver_Success() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit ResolverUpdated(resolver, true);
        predictionMarket.setResolver(resolver, true);

        assertTrue(predictionMarket.authorizedResolvers(resolver));
    }

    function test_SetResolver_Remove() public {
        vm.startPrank(owner);
        predictionMarket.setResolver(resolver, true);

        vm.expectEmit(true, false, false, true);
        emit ResolverUpdated(resolver, false);
        predictionMarket.setResolver(resolver, false);
        vm.stopPrank();

        assertFalse(predictionMarket.authorizedResolvers(resolver));
    }

    function test_SetResolver_RevertWhen_NotOwner() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        predictionMarket.setResolver(resolver, true);
    }

    function test_SetResolver_RevertWhen_ZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("Invalid resolver address");
        predictionMarket.setResolver(address(0), true);
    }

    /* ============ Market Creation Tests ============ */

    function test_CreateMarket_Success() public {
        uint256 resolutionTime = block.timestamp + 3600;

        vm.prank(creator);
        vm.expectEmit(true, false, false, true);
        emit MarketCreated(marketId, PredictionMarket.MarketType.BLOCK, question, creator, dataSourceId);

        predictionMarket.createMarket(
            marketId,
            PredictionMarket.MarketType.BLOCK,
            question,
            resolutionTime,
            dataSourceId
        );

        PredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(market.marketId, marketId);
        assertEq(market.question, question);
        assertEq(market.creator, creator);
        assertEq(uint(market.status), uint(PredictionMarket.MarketStatus.ACTIVE));
        assertEq(market.totalPool, 0);
    }

    function test_CreateMarket_RevertWhen_DuplicateId() public {
        uint256 resolutionTime = block.timestamp + 3600;

        vm.startPrank(creator);
        predictionMarket.createMarket(marketId, PredictionMarket.MarketType.BLOCK, question, resolutionTime, dataSourceId);

        vm.expectRevert("Market already exists");
        predictionMarket.createMarket(marketId, PredictionMarket.MarketType.BLOCK, "Different question", resolutionTime, dataSourceId);
        vm.stopPrank();
    }

    function test_CreateMarket_RevertWhen_PastResolutionTime() public {
        uint256 pastTime = block.timestamp - 3600;

        vm.prank(creator);
        vm.expectRevert("Invalid resolution time");
        predictionMarket.createMarket(marketId, PredictionMarket.MarketType.BLOCK, question, pastTime, dataSourceId);
    }

    function test_CreateMarket_RevertWhen_EmptyQuestion() public {
        uint256 resolutionTime = block.timestamp + 3600;

        vm.prank(creator);
        vm.expectRevert("Question cannot be empty");
        predictionMarket.createMarket(marketId, PredictionMarket.MarketType.BLOCK, "", resolutionTime, dataSourceId);
    }

    /* ============ Placing Bets Tests ============ */

    function test_PlaceBet_Success() public {
        _createMarket();

        vm.prank(bettor1);
        vm.expectEmit(true, true, false, true);
        emit BetPlaced(marketId, bettor1, 0, 1 ether, block.timestamp);
        predictionMarket.placeBet{value: 1 ether}(marketId, 0);

        PredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(market.totalPool, 1 ether);
        assertEq(market.optionPools[0], 1 ether);
        assertEq(market.optionPools[1], 0);
    }

    function test_PlaceBet_MultipleBetsFromSameUser() public {
        _createMarket();

        vm.startPrank(bettor1);
        predictionMarket.placeBet{value: 1 ether}(marketId, 0);
        predictionMarket.placeBet{value: 0.5 ether}(marketId, 1);
        vm.stopPrank();

        PredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(market.totalPool, 1.5 ether);
        assertEq(market.optionPools[0], 1 ether);
        assertEq(market.optionPools[1], 0.5 ether);
    }

    function test_PlaceBet_RevertWhen_BelowMinimum() public {
        _createMarket();

        vm.prank(bettor1);
        vm.expectRevert("Bet too small");
        predictionMarket.placeBet{value: 0.005 ether}(marketId, 0);
    }

    function test_PlaceBet_RevertWhen_AboveMaximum() public {
        _createMarket();

        vm.deal(bettor1, 200 ether);
        vm.prank(bettor1);
        vm.expectRevert("Bet too large");
        predictionMarket.placeBet{value: 101 ether}(marketId, 0);
    }

    function test_PlaceBet_RevertWhen_InvalidOption() public {
        _createMarket();

        vm.prank(bettor1);
        vm.expectRevert("Invalid option");
        predictionMarket.placeBet{value: 1 ether}(marketId, 2);
    }

    function test_PlaceBet_RevertWhen_MarketDoesNotExist() public {
        bytes32 fakeMarketId = keccak256("fake");

        vm.prank(bettor1);
        vm.expectRevert("Market does not exist");
        predictionMarket.placeBet{value: 1 ether}(fakeMarketId, 0);
    }

    /* ============ Market Resolution Tests ============ */

    function test_ResolveMarket_ByAuthorizedResolver() public {
        _createMarketWithBets();
        vm.warp(block.timestamp + 3601);

        vm.prank(resolver);
        vm.expectEmit(true, false, false, true);
        emit MarketResolved(marketId, 0, 3 ether, block.timestamp);
        predictionMarket.resolveMarket(marketId, 0);

        PredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(uint(market.status), uint(PredictionMarket.MarketStatus.RESOLVED));
        assertEq(market.winningOption, 0);
    }

    function test_ResolveMarket_ByOwner() public {
        _createMarketWithBets();
        vm.warp(block.timestamp + 3601);

        vm.prank(owner);
        predictionMarket.resolveMarket(marketId, 1);

        PredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(uint(market.status), uint(PredictionMarket.MarketStatus.RESOLVED));
        assertEq(market.winningOption, 1);
    }

    function test_ResolveMarket_RevertWhen_Unauthorized() public {
        _createMarketWithBets();
        vm.warp(block.timestamp + 3601);

        vm.prank(unauthorized);
        vm.expectRevert("Not authorized resolver");
        predictionMarket.resolveMarket(marketId, 0);
    }

    function test_ResolveMarket_RevertWhen_TooEarly() public {
        _createMarketWithBets();

        vm.prank(resolver);
        vm.expectRevert("Too early to resolve");
        predictionMarket.resolveMarket(marketId, 0);
    }

    function test_ResolveMarket_RevertWhen_InvalidOption() public {
        _createMarketWithBets();
        vm.warp(block.timestamp + 3601);

        vm.prank(resolver);
        vm.expectRevert("Invalid winning option");
        predictionMarket.resolveMarket(marketId, 2);
    }

    function test_ResolveMarket_RevertWhen_AlreadyResolved() public {
        _createMarketWithBets();
        vm.warp(block.timestamp + 3601);

        vm.startPrank(resolver);
        predictionMarket.resolveMarket(marketId, 0);

        vm.expectRevert("Market not active");
        predictionMarket.resolveMarket(marketId, 1);
        vm.stopPrank();
    }

    /* ============ Claiming Winnings Tests ============ */

    function test_ClaimWinnings_CorrectCalculation() public {
        _createMarketWithBets();
        vm.warp(block.timestamp + 3601);

        vm.prank(resolver);
        predictionMarket.resolveMarket(marketId, 0);

        uint256 balanceBefore = bettor1.balance;

        vm.prank(bettor1);
        predictionMarket.claimWinnings(marketId);

        uint256 balanceAfter = bettor1.balance;

        // bettor1 bet 2 ETH on YES, total pool 3 ETH, winning pool 2 ETH
        // Gross winnings: (2 * 3) / 2 = 3 ETH
        // Profit: 3 - 2 = 1 ETH
        // Fee: 1 * 200 / 10000 = 0.02 ETH
        // Payout: 3 - 0.02 = 2.98 ETH
        assertEq(balanceAfter - balanceBefore, 2.98 ether);
    }

    function test_ClaimWinnings_MultipleWinners() public {
        _createMarket();

        vm.prank(bettor1);
        predictionMarket.placeBet{value: 1 ether}(marketId, 0);

        vm.prank(bettor2);
        predictionMarket.placeBet{value: 1 ether}(marketId, 0);

        vm.prank(bettor3);
        predictionMarket.placeBet{value: 2 ether}(marketId, 1);

        vm.warp(block.timestamp + 3601);
        vm.prank(resolver);
        predictionMarket.resolveMarket(marketId, 0);

        vm.prank(bettor1);
        predictionMarket.claimWinnings(marketId);

        vm.prank(bettor2);
        predictionMarket.claimWinnings(marketId);

        assertTrue(predictionMarket.collectedFees() > 0);
    }

    function test_ClaimWinnings_RevertWhen_DoubleClaim() public {
        _createMarketWithBets();
        vm.warp(block.timestamp + 3601);

        vm.prank(resolver);
        predictionMarket.resolveMarket(marketId, 0);

        vm.startPrank(bettor1);
        predictionMarket.claimWinnings(marketId);

        vm.expectRevert("No winnings to claim");
        predictionMarket.claimWinnings(marketId);
        vm.stopPrank();
    }

    function test_ClaimWinnings_RevertWhen_LosingBet() public {
        _createMarketWithBets();
        vm.warp(block.timestamp + 3601);

        vm.prank(resolver);
        predictionMarket.resolveMarket(marketId, 0);

        vm.prank(bettor2);
        vm.expectRevert("No winnings to claim");
        predictionMarket.claimWinnings(marketId);
    }

    function test_ClaimWinnings_RevertWhen_NotResolved() public {
        _createMarketWithBets();

        vm.prank(bettor1);
        vm.expectRevert("Market not resolved");
        predictionMarket.claimWinnings(marketId);
    }

    /* ============ Market Cancellation Tests ============ */

    function test_CancelMarket_ByCreator() public {
        _createMarket();

        vm.prank(creator);
        vm.expectEmit(true, false, false, false);
        emit MarketCancelled(marketId);
        predictionMarket.cancelMarket(marketId);

        PredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(uint(market.status), uint(PredictionMarket.MarketStatus.CANCELLED));
    }

    function test_CancelMarket_ByOwner() public {
        _createMarket();

        vm.prank(owner);
        predictionMarket.cancelMarket(marketId);

        PredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(uint(market.status), uint(PredictionMarket.MarketStatus.CANCELLED));
    }

    function test_CancelMarket_RevertWhen_Unauthorized() public {
        _createMarket();

        vm.prank(unauthorized);
        vm.expectRevert("Not authorized");
        predictionMarket.cancelMarket(marketId);
    }

    function test_RefundBets_Success() public {
        _createMarket();

        vm.prank(bettor1);
        predictionMarket.placeBet{value: 2 ether}(marketId, 0);

        vm.prank(owner);
        predictionMarket.cancelMarket(marketId);

        uint256 balanceBefore = bettor1.balance;

        vm.prank(bettor1);
        predictionMarket.refundBets(marketId);

        uint256 balanceAfter = bettor1.balance;
        assertEq(balanceAfter - balanceBefore, 2 ether);
    }

    function test_RefundBets_RevertWhen_DoubleClaim() public {
        _createMarket();

        vm.prank(bettor1);
        predictionMarket.placeBet{value: 1 ether}(marketId, 0);

        vm.prank(owner);
        predictionMarket.cancelMarket(marketId);

        vm.startPrank(bettor1);
        predictionMarket.refundBets(marketId);

        vm.expectRevert("No refunds available");
        predictionMarket.refundBets(marketId);
        vm.stopPrank();
    }

    /* ============ Fee Management Tests ============ */

    function test_WithdrawFees_Success() public {
        _createMarketWithBets();
        vm.warp(block.timestamp + 3601);

        vm.prank(resolver);
        predictionMarket.resolveMarket(marketId, 0);

        vm.prank(bettor1);
        predictionMarket.claimWinnings(marketId);

        uint256 fees = predictionMarket.collectedFees();
        assertTrue(fees > 0);

        uint256 balanceBefore = owner.balance;

        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit FeesWithdrawn(owner, fees);
        predictionMarket.withdrawFees();

        uint256 balanceAfter = owner.balance;
        assertEq(balanceAfter - balanceBefore, fees);
        assertEq(predictionMarket.collectedFees(), 0);
    }

    function test_WithdrawFees_RevertWhen_NotOwner() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        predictionMarket.withdrawFees();
    }

    function test_WithdrawFees_RevertWhen_NoFees() public {
        vm.prank(owner);
        vm.expectRevert("No fees to withdraw");
        predictionMarket.withdrawFees();
    }

    function test_SetPlatformFee_Success() public {
        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit PlatformFeeUpdated(200, 500);
        predictionMarket.setPlatformFee(500);

        assertEq(predictionMarket.platformFee(), 500);
    }

    function test_SetPlatformFee_RevertWhen_TooHigh() public {
        vm.prank(owner);
        vm.expectRevert("Fee too high");
        predictionMarket.setPlatformFee(1001);
    }

    /* ============ Bet Limits Tests ============ */

    function test_SetBetLimits_Success() public {
        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit BetLimitsUpdated(0.1 ether, 50 ether);
        predictionMarket.setBetLimits(0.1 ether, 50 ether);

        assertEq(predictionMarket.minBetAmount(), 0.1 ether);
        assertEq(predictionMarket.maxBetAmount(), 50 ether);
    }

    function test_SetBetLimits_RevertWhen_InvalidLimits() public {
        vm.prank(owner);
        vm.expectRevert("Invalid limits");
        predictionMarket.setBetLimits(10 ether, 5 ether);
    }

    /* ============ View Functions Tests ============ */

    function test_GetOdds_WithBets() public {
        _createMarketWithBets();

        uint256[2] memory odds = predictionMarket.getOdds(marketId);

        // YES: 2 ETH, Total: 3 ETH -> odds = 3/2 = 1.5x = 15000 basis points
        assertEq(odds[0], 15000);
        // NO: 1 ETH, Total: 3 ETH -> odds = 3/1 = 3x = 30000 basis points
        assertEq(odds[1], 30000);
    }

    function test_GetOdds_EmptyMarket() public {
        _createMarket();

        uint256[2] memory odds = predictionMarket.getOdds(marketId);

        assertEq(odds[0], 20000); // 2x default
        assertEq(odds[1], 20000); // 2x default
    }

    function test_GetUserMarketBets() public {
        _createMarket();

        vm.startPrank(bettor1);
        predictionMarket.placeBet{value: 1 ether}(marketId, 0);
        predictionMarket.placeBet{value: 0.5 ether}(marketId, 1);
        vm.stopPrank();

        PredictionMarket.Bet[] memory userBets = predictionMarket.getUserMarketBets(marketId, bettor1);
        assertEq(userBets.length, 2);
        assertEq(userBets[0].amount, 1 ether);
        assertEq(userBets[1].amount, 0.5 ether);
    }

    /* ============ Fuzz Tests ============ */

    function testFuzz_PlaceBet(uint256 betAmount) public {
        _createMarket();

        betAmount = bound(betAmount, 0.01 ether, 100 ether);

        vm.deal(bettor1, betAmount);
        vm.prank(bettor1);
        predictionMarket.placeBet{value: betAmount}(marketId, 0);

        PredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(market.totalPool, betAmount);
    }

    function testFuzz_SetPlatformFee(uint256 fee) public {
        fee = bound(fee, 0, 1000);

        vm.prank(owner);
        predictionMarket.setPlatformFee(fee);

        assertEq(predictionMarket.platformFee(), fee);
    }

    /* ============ Helper Functions ============ */

    function _createMarket() internal {
        uint256 resolutionTime = block.timestamp + 3600;

        vm.prank(creator);
        predictionMarket.createMarket(
            marketId,
            PredictionMarket.MarketType.GAME,
            question,
            resolutionTime,
            dataSourceId
        );
    }

    function _createMarketWithBets() internal {
        _createMarket();

        vm.deal(bettor1, 10 ether);
        vm.prank(bettor1);
        predictionMarket.placeBet{value: 2 ether}(marketId, 0);

        vm.deal(bettor2, 10 ether);
        vm.prank(bettor2);
        predictionMarket.placeBet{value: 1 ether}(marketId, 1);
    }
}
