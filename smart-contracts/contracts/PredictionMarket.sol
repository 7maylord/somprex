// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PredictionMarket
 * @dev Multi-event prediction market powered by Somnia Data Streams
 * @notice Uses SOMI ERC20 token for betting
 */
contract PredictionMarket is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Market Types
    enum MarketType { BLOCK, TRANSFER, GAME }
    enum MarketStatus { ACTIVE, LOCKED, RESOLVED, CANCELLED }

    // Market Structure
    struct Market {
        bytes32 marketId;
        MarketType marketType;
        string question;
        address creator;
        uint256 createdAt;
        uint256 resolutionTime;
        MarketStatus status;
        uint8 winningOption; // 0 = YES, 1 = NO
        uint256 totalPool;
        uint256[2] optionPools; // [YES pool, NO pool]
        bytes32 dataSourceId; // SDS stream identifier
        uint256 threshold; // Optional: for BLOCK/TRANSFER markets (0 if not used)
        address thresholdToken; // Optional: for TRANSFER markets (address(0) if not used)
    }

    // Bet Structure
    struct Bet {
        address bettor;
        bytes32 marketId;
        uint8 option; // 0 = YES, 1 = NO
        uint256 amount;
        uint256 timestamp;
        bool claimed;
    }

    // State Variables
    IERC20 public immutable somiToken;

    mapping(bytes32 => Market) public markets;
    mapping(bytes32 => Bet[]) public marketBets;
    mapping(address => bytes32[]) public userBets;
    mapping(bytes32 => mapping(address => uint256[])) public userBetIndices;

    bytes32[] public activeMarkets;

    uint256 public platformFee = 200; // 2% (in basis points)
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public minBetAmount = 0.01 ether; // 0.01 SOMI (18 decimals)
    uint256 public maxBetAmount = 100 ether; // 100 SOMI
    uint256 public collectedFees; // Track fees separately

    // Authorized resolvers (SDS services)
    mapping(address => bool) public authorizedResolvers;

    // Events
    event MarketCreated(
        bytes32 indexed marketId,
        MarketType marketType,
        string question,
        address indexed creator,
        bytes32 dataSourceId,
        uint256 threshold,
        address thresholdToken
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
        uint256 totalPool
    );

    event WinningsClaimed(
        bytes32 indexed marketId,
        address indexed bettor,
        uint256 amount
    );

    event MarketCancelled(bytes32 indexed marketId);

    event BetsRefunded(bytes32 indexed marketId, uint256 totalRefunded);

    event FeesWithdrawn(address indexed owner, uint256 amount);

    event PlatformFeeUpdated(uint256 newFee);

    event BetLimitsUpdated(uint256 minAmount, uint256 maxAmount);

    event ResolverUpdated(address indexed resolver, bool authorized);

    // Modifiers
    modifier onlyResolver() {
        require(authorizedResolvers[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    /**
     * @dev Constructor
     * @param _somiToken Address of the SOMI ERC20 token
     */
    constructor(address _somiToken) Ownable(msg.sender) {
        require(_somiToken != address(0), "Invalid token address");
        somiToken = IERC20(_somiToken);

        // Set deployer as authorized resolver
        authorizedResolvers[msg.sender] = true;
    }

    /**
     * @dev Create a new prediction market
     * @param _threshold Optional: for BLOCK markets (tx count) or TRANSFER markets (amount). Use 0 for GAME markets.
     * @param _thresholdToken Optional: for TRANSFER markets, specify token address. Use address(0) for BLOCK/GAME markets.
     */
    function createMarket(
        bytes32 _marketId,
        MarketType _marketType,
        string memory _question,
        uint256 _resolutionTime,
        bytes32 _dataSourceId,
        uint256 _threshold,
        address _thresholdToken
    ) external returns (bytes32) {
        require(markets[_marketId].marketId == bytes32(0), "Market already exists");
        require(_resolutionTime > block.timestamp, "Invalid resolution time");
        require(bytes(_question).length > 0, "Question cannot be empty");

        Market memory newMarket = Market({
            marketId: _marketId,
            marketType: _marketType,
            question: _question,
            creator: msg.sender,
            createdAt: block.timestamp,
            resolutionTime: _resolutionTime,
            status: MarketStatus.ACTIVE,
            winningOption: 0,
            totalPool: 0,
            optionPools: [uint256(0), uint256(0)],
            dataSourceId: _dataSourceId,
            threshold: _threshold,
            thresholdToken: _thresholdToken
        });

        markets[_marketId] = newMarket;
        activeMarkets.push(_marketId);

        emit MarketCreated(
            _marketId,
            _marketType,
            _question,
            msg.sender,
            _dataSourceId,
            _threshold,
            _thresholdToken
        );

        return _marketId;
    }

    /**
     * @dev Place a bet on a market using SOMI tokens
     */
    function placeBet(
        bytes32 _marketId,
        uint8 _option,
        uint256 _amount
    ) external nonReentrant {
        Market storage market = markets[_marketId];

        require(market.marketId != bytes32(0), "Market does not exist");
        require(market.status == MarketStatus.ACTIVE, "Market not active");
        require(_option <= 1, "Invalid option");
        require(_amount >= minBetAmount, "Bet too small");
        require(_amount <= maxBetAmount, "Bet too large");

        // Transfer SOMI tokens from user to contract
        somiToken.safeTransferFrom(msg.sender, address(this), _amount);

        Bet memory newBet = Bet({
            bettor: msg.sender,
            marketId: _marketId,
            option: _option,
            amount: _amount,
            timestamp: block.timestamp,
            claimed: false
        });

        marketBets[_marketId].push(newBet);
        userBets[msg.sender].push(_marketId);
        userBetIndices[_marketId][msg.sender].push(marketBets[_marketId].length - 1);

        market.optionPools[_option] += _amount;
        market.totalPool += _amount;

        emit BetPlaced(_marketId, msg.sender, _option, _amount, block.timestamp);
    }

    /**
     * @dev Resolve a market (only authorized resolvers)
     */
    function resolveMarket(
        bytes32 _marketId,
        uint8 _winningOption
    ) external onlyResolver {
        Market storage market = markets[_marketId];

        require(market.marketId != bytes32(0), "Market does not exist");
        require(market.status == MarketStatus.ACTIVE, "Market not active");
        require(_winningOption <= 1, "Invalid option");
        require(block.timestamp >= market.resolutionTime, "Market not ready");

        market.status = MarketStatus.RESOLVED;
        market.winningOption = _winningOption;

        emit MarketResolved(_marketId, _winningOption, market.totalPool);
    }

    /**
     * @dev Claim winnings from a resolved market
     */
    function claimWinnings(bytes32 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];

        require(market.marketId != bytes32(0), "Market does not exist");
        require(market.status == MarketStatus.RESOLVED, "Market not resolved");

        uint256[] storage betIndices = userBetIndices[_marketId][msg.sender];
        require(betIndices.length > 0, "No bets found");

        uint256 totalWinnings = 0;
        uint256 winningPool = market.optionPools[market.winningOption];
        uint256 losingPool = market.optionPools[market.winningOption == 0 ? 1 : 0];

        for (uint256 i = 0; i < betIndices.length; i++) {
            Bet storage bet = marketBets[_marketId][betIndices[i]];

            if (!bet.claimed && bet.option == market.winningOption) {
                bet.claimed = true;

                // Calculate share of losing pool
                uint256 share = (bet.amount * losingPool) / winningPool;

                // Calculate fee (2% of profit only)
                uint256 profit = share;
                uint256 fee = (profit * platformFee) / BASIS_POINTS;

                // Total payout = original bet + profit - fee
                uint256 payout = bet.amount + profit - fee;

                totalWinnings += payout;
                collectedFees += fee;
            }
        }

        require(totalWinnings > 0, "No winnings to claim");

        // Transfer SOMI tokens to winner
        somiToken.safeTransfer(msg.sender, totalWinnings);

        emit WinningsClaimed(_marketId, msg.sender, totalWinnings);
    }

    /**
     * @dev Cancel a market and enable refunds
     */
    function cancelMarket(bytes32 _marketId) external onlyOwner {
        Market storage market = markets[_marketId];

        require(market.marketId != bytes32(0), "Market does not exist");
        require(market.status == MarketStatus.ACTIVE, "Market not active");

        market.status = MarketStatus.CANCELLED;

        emit MarketCancelled(_marketId);
    }

    /**
     * @dev Refund all bets for a cancelled market
     */
    function refundBets(bytes32 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];

        require(market.marketId != bytes32(0), "Market does not exist");
        require(market.status == MarketStatus.CANCELLED, "Market not cancelled");

        uint256[] storage betIndices = userBetIndices[_marketId][msg.sender];
        require(betIndices.length > 0, "No bets to refund");

        uint256 totalRefund = 0;

        for (uint256 i = 0; i < betIndices.length; i++) {
            Bet storage bet = marketBets[_marketId][betIndices[i]];

            if (!bet.claimed) {
                bet.claimed = true;
                totalRefund += bet.amount;
            }
        }

        require(totalRefund > 0, "No refunds available");

        // Transfer SOMI tokens back to user
        somiToken.safeTransfer(msg.sender, totalRefund);

        emit BetsRefunded(_marketId, totalRefund);
    }

    /**
     * @dev Withdraw collected platform fees (only owner)
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = collectedFees;
        require(amount > 0, "No fees to withdraw");

        collectedFees = 0;
        somiToken.safeTransfer(msg.sender, amount);

        emit FeesWithdrawn(msg.sender, amount);
    }

    /**
     * @dev Set platform fee (only owner)
     */
    function setPlatformFee(uint256 _fee) external onlyOwner {
        require(_fee <= 1000, "Fee too high"); // Max 10%
        platformFee = _fee;
        emit PlatformFeeUpdated(_fee);
    }

    /**
     * @dev Set bet limits (only owner)
     */
    function setBetLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min < _max, "Invalid limits");
        minBetAmount = _min;
        maxBetAmount = _max;
        emit BetLimitsUpdated(_min, _max);
    }

    /**
     * @dev Set resolver authorization (only owner)
     */
    function setResolver(address _resolver, bool _authorized) external onlyOwner {
        authorizedResolvers[_resolver] = _authorized;
        emit ResolverUpdated(_resolver, _authorized);
    }

    /**
     * @dev Get all active markets
     */
    function getActiveMarkets() external view returns (bytes32[] memory) {
        return activeMarkets;
    }

    /**
     * @dev Calculate current odds for a market
     */
    function getOdds(bytes32 _marketId) external view returns (uint256 yesOdds, uint256 noOdds) {
        Market storage market = markets[_marketId];

        if (market.totalPool == 0) {
            return (2 * BASIS_POINTS, 2 * BASIS_POINTS); // 2.0x for both
        }

        yesOdds = market.optionPools[0] > 0
            ? (market.totalPool * BASIS_POINTS) / market.optionPools[0]
            : 0;

        noOdds = market.optionPools[1] > 0
            ? (market.totalPool * BASIS_POINTS) / market.optionPools[1]
            : 0;
    }

    /**
     * @dev Get market details
     */
    function getMarket(bytes32 _marketId) external view returns (Market memory) {
        return markets[_marketId];
    }

    /**
     * @dev Get all bets for a market
     */
    function getMarketBets(bytes32 _marketId) external view returns (Bet[] memory) {
        return marketBets[_marketId];
    }

    /**
     * @dev Get user's bets for a specific market
     */
    function getUserMarketBets(
        bytes32 _marketId,
        address _user
    ) external view returns (Bet[] memory) {
        uint256[] storage indices = userBetIndices[_marketId][_user];
        Bet[] memory userMarketBets = new Bet[](indices.length);

        for (uint256 i = 0; i < indices.length; i++) {
            userMarketBets[i] = marketBets[_marketId][indices[i]];
        }

        return userMarketBets;
    }
}
