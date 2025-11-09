// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PredictionMarket.sol";

contract PredictionMarketTest is Test {
    PredictionMarket public predictionMarket;

    address owner = address(this); // Test contract is owner
    address resolver = makeAddr("resolver");
    address creator = makeAddr("creator");
    address bettor1 = makeAddr("bettor1");
    address bettor2 = makeAddr("bettor2");
    address bettor3 = makeAddr("bettor3");
    address unauthorized = makeAddr("unauthorized");

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
        predictionMarket = new PredictionMarket();
        predictionMarket.setResolver(resolver, true);
        
        // Fund test accounts
        vm.deal(bettor1, 50 ether);
        vm.deal(bettor2, 50 ether);
        vm.deal(bettor3, 100 ether);
        vm.deal(creator, 10 ether);
    }

    /* ============ Deployment Tests ============ */

    function test_Deployment_OwnerIsSet() public view {
        assertEq(predictionMarket.owner(), owner);
    }

    function test_Deployment_OwnerIsAuthorizedResolver() public view {
        assertTrue(predictionMarket.authorizedResolvers(owner));
    }

    function test_Deployment_DefaultValues() public view {
        assertEq(predictionMarket.platformFee(), 200);
        assertEq(predictionMarket.minBetAmount(), 0.01 ether);
        assertEq(predictionMarket.maxBetAmount(), 100 ether);
        assertEq(predictionMarket.collectedFees(), 0);
    }

    /* ============ Resolver Management Tests ============ */

    function test_SetResolver_Success() public {
        address newResolver = makeAddr("newResolver");
        
        vm.expectEmit(true, false, false, true);
        emit ResolverUpdated(newResolver, true);
        predictionMarket.setResolver(newResolver, true);

        assertTrue(predictionMarket.authorizedResolvers(newResolver));
    }

    function test_SetResolver_Remove() public {
        vm.expectEmit(true, false, false, true);
        emit ResolverUpdated(resolver, false);
        predictionMarket.setResolver(resolver, false);

        assertFalse(predictionMarket.authorizedResolvers(resolver));
    }

    function test_SetResolver_RevertWhen_NotOwner() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        predictionMarket.setResolver(resolver, true);
    }

    function test_SetResolver_RevertWhen_ZeroAddress() public {
        vm.expectRevert("Invalid resolver address");
        predictionMarket.setResolver(address(0), true);
    }

    /* ============ Market Creation Tests ============ */

    function test_CreateMarket_Success() public {
        uint256 resolutionTime = block.timestamp + 3600;

        vm.prank(creator);
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
        predictionMarket.createMarket(marketId, PredictionMarket.MarketType.BLOCK, "Different", resolutionTime, dataSourceId);
        vm.stopPrank();
    }

    function test_CreateMarket_RevertWhen_PastResolutionTime() public {
        vm.warp(7200);
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

        vm.deal(bettor1, 150 ether);
        vm.prank(bettor1);
        predictionMarket.placeBet{value: 1 ether}(marketId, 0);

        PredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(market.totalPool, 1 ether);
        assertEq(market.optionPools[0], 1 ether);
    }

    function test_PlaceBet_MultipleBetsFromSameUser() public {
        _createMarket();

        vm.startPrank(bettor1);
        predictionMarket.placeBet{value: 1 ether}(marketId, 0);
        predictionMarket.placeBet{value: 0.5 ether}(marketId, 1);
        vm.stopPrank();

        PredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(market.totalPool, 1.5 ether);
    }

    function test_PlaceBet_RevertWhen_BelowMinimum() public {
        _createMarket();

        vm.deal(bettor1, 150 ether);
        vm.prank(bettor1);
        vm.expectRevert("Bet too small");
        predictionMarket.placeBet{value: 0.005 ether}(marketId, 0);
    }

    function test_PlaceBet_RevertWhen_AboveMaximum() public {
        _createMarket();

        vm.deal(bettor1, 150 ether);
        vm.deal(bettor1, 150 ether);
        vm.prank(bettor1);
        vm.expectRevert("Bet too large");
        predictionMarket.placeBet{value: 101 ether}(marketId, 0);
    }

    function test_PlaceBet_RevertWhen_InvalidOption() public {
        _createMarket();

        vm.deal(bettor1, 150 ether);
        vm.prank(bettor1);
        vm.expectRevert("Invalid option");
        predictionMarket.placeBet{value: 1 ether}(marketId, 2);
    }

    function test_PlaceBet_RevertWhen_MarketDoesNotExist() public {
        bytes32 fakeMarketId = keccak256("fake");

        vm.deal(bettor1, 150 ether);
        vm.prank(bettor1);
        vm.expectRevert("Market does not exist");
        predictionMarket.placeBet{value: 1 ether}(fakeMarketId, 0);
    }

    /* ============ Market Resolution Tests ============ */

    function test_ResolveMarket_ByAuthorizedResolver() public {
        _createMarketWithBets();
        vm.warp(block.timestamp + 3601);

        vm.prank(resolver);
        predictionMarket.resolveMarket(marketId, 0);

        PredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(uint(market.status), uint(PredictionMarket.MarketStatus.RESOLVED));
        assertEq(market.winningOption, 0);
    }

    function test_ResolveMarket_ByOwner() public {
        _createMarketWithBets();
        vm.warp(block.timestamp + 3601);

        predictionMarket.resolveMarket(marketId, 1);

        PredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(uint(market.status), uint(PredictionMarket.MarketStatus.RESOLVED));
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

        // Bettor already has funds
        vm.prank(bettor1);
        predictionMarket.claimWinnings(marketId);

        uint256 balanceAfter = bettor1.balance;

        // Gross: (2 * 3) / 2 = 3 ETH
        // Profit: 1 ETH, Fee: 0.02 ETH
        // Payout: 2.98 ETH
        assertEq(balanceAfter - balanceBefore, 2.98 ether);
    }

    function test_ClaimWinnings_MultipleWinners() public {
        _createMarket();

        vm.deal(bettor1, 150 ether);
        vm.prank(bettor1);
        predictionMarket.placeBet{value: 1 ether}(marketId, 0);

        vm.prank(bettor2);
        predictionMarket.placeBet{value: 1 ether}(marketId, 0);

        vm.prank(bettor3);
        predictionMarket.placeBet{value: 2 ether}(marketId, 1);

        vm.warp(block.timestamp + 3601);
        vm.prank(resolver);
        predictionMarket.resolveMarket(marketId, 0);

        vm.deal(bettor1, 150 ether);
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

        // Bettor already has funds
        vm.prank(bettor1);
        vm.expectRevert("Market not resolved");
        predictionMarket.claimWinnings(marketId);
    }

    /* ============ Market Cancellation Tests ============ */

    function test_CancelMarket_ByCreator() public {
        _createMarket();

        vm.prank(creator);
        predictionMarket.cancelMarket(marketId);

        PredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(uint(market.status), uint(PredictionMarket.MarketStatus.CANCELLED));
    }

    function test_CancelMarket_ByOwner() public {
        _createMarket();

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

        predictionMarket.cancelMarket(marketId);

        uint256 balanceBefore = bettor1.balance;

        
        vm.prank(bettor1);
        predictionMarket.refundBets(marketId);

        uint256 balanceAfter = bettor1.balance;
        assertEq(balanceAfter - balanceBefore, 2 ether);
    }

    function test_RefundBets_RevertWhen_DoubleClaim() public {
        _createMarket();

        vm.deal(bettor1, 150 ether);
        vm.prank(bettor1);
        predictionMarket.placeBet{value: 1 ether}(marketId, 0);

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

        // Bettor already has funds
        vm.prank(bettor1);
        predictionMarket.claimWinnings(marketId);

        uint256 fees = predictionMarket.collectedFees();
        assertTrue(fees > 0);

        uint256 balanceBefore = owner.balance;
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
        vm.expectRevert("No fees to withdraw");
        predictionMarket.withdrawFees();
    }

    function test_SetPlatformFee_Success() public {
        predictionMarket.setPlatformFee(500);
        assertEq(predictionMarket.platformFee(), 500);
    }

    function test_SetPlatformFee_RevertWhen_TooHigh() public {
        vm.expectRevert("Fee too high");
        predictionMarket.setPlatformFee(1001);
    }

    /* ============ Bet Limits Tests ============ */

    function test_SetBetLimits_Success() public {
        predictionMarket.setBetLimits(0.1 ether, 50 ether);
        assertEq(predictionMarket.minBetAmount(), 0.1 ether);
        assertEq(predictionMarket.maxBetAmount(), 50 ether);
    }

    function test_SetBetLimits_RevertWhen_InvalidLimits() public {
        vm.expectRevert("Invalid limits");
        predictionMarket.setBetLimits(10 ether, 5 ether);
    }

    /* ============ View Functions Tests ============ */

    function test_GetOdds_WithBets() public {
        _createMarketWithBets();

        uint256[2] memory odds = predictionMarket.getOdds(marketId);
        assertEq(odds[0], 15000); // 1.5x
        assertEq(odds[1], 30000); // 3x
    }

    function test_GetOdds_EmptyMarket() public {
        _createMarket();

        uint256[2] memory odds = predictionMarket.getOdds(marketId);
        assertEq(odds[0], 20000);
        assertEq(odds[1], 20000);
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
        vm.deal(bettor1, 150 ether);
        vm.prank(bettor1);
        predictionMarket.placeBet{value: betAmount}(marketId, 0);

        PredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(market.totalPool, betAmount);
    }

    function testFuzz_SetPlatformFee(uint256 fee) public {
        fee = bound(fee, 0, 1000);
        predictionMarket.setPlatformFee(fee);
        assertEq(predictionMarket.platformFee(), fee);
    }

    /* ============ Edge Cases ============ */

    function test_ClaimWinnings_NoLosingPool() public {
        _createMarket();

        // All bets on YES
        
        vm.prank(bettor1);
        predictionMarket.placeBet{value: 2 ether}(marketId, 0);

        vm.prank(bettor2);
        predictionMarket.placeBet{value: 1 ether}(marketId, 0);

        vm.warp(block.timestamp + 3601);
        vm.prank(resolver);
        predictionMarket.resolveMarket(marketId, 0);

        uint256 balance1Before = bettor1.balance;
        
        vm.prank(bettor1);
        predictionMarket.claimWinnings(marketId);
        uint256 balance1After = bettor1.balance;

        // Should get back original bet (no profit, no fee)
        assertEq(balance1After - balance1Before, 2 ether);
        assertEq(predictionMarket.collectedFees(), 0);
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

        // Bettor already has funds
        vm.prank(bettor1);
        predictionMarket.placeBet{value: 2 ether}(marketId, 0);

        vm.prank(bettor2);
        predictionMarket.placeBet{value: 1 ether}(marketId, 1);
    }

    receive() external payable {}
}
