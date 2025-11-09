// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PredictionMarket
 * @dev Multi-event prediction market powered by Somnia Data Streams
 * Supports Block, Token Transfer, and Game event markets
 */
contract PredictionMarket is Ownable, ReentrancyGuard {
    
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
    mapping(bytes32 => Market) public markets;
    mapping(bytes32 => Bet[]) public marketBets;
    mapping(address => bytes32[]) public userBets;
    mapping(bytes32 => mapping(address => uint256[])) public userBetIndices;
    
    bytes32[] public activeMarkets;

    uint256 public platformFee = 200; // 2% (in basis points)
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public minBetAmount = 0.01 ether;
    uint256 public maxBetAmount = 100 ether;
    uint256 public collectedFees; // Track fees separately

    // Authorized resolvers (SDS services)
    mapping(address => bool) public authorizedResolvers;
    
    // Events
    event MarketCreated(
        bytes32 indexed marketId,
        MarketType marketType,
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

    modifier onlyResolver() {
        require(
            authorizedResolvers[msg.sender] || msg.sender == owner(),
            "Not authorized resolver"
        );
        _;
    }

    constructor() Ownable(msg.sender) {
        // Owner is automatically an authorized resolver
        authorizedResolvers[msg.sender] = true;
    }
    
    /**
     * @dev Create a new prediction market
     */
    function createMarket(
        bytes32 _marketId,
        MarketType _marketType,
        string memory _question,
        uint256 _resolutionTime,
        bytes32 _dataSourceId
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
            dataSourceId: _dataSourceId
        });
        
        markets[_marketId] = newMarket;
        activeMarkets.push(_marketId);
        
        emit MarketCreated(
            _marketId,
            _marketType,
            _question,
            msg.sender,
            _dataSourceId
        );
        
        return _marketId;
    }
    
    /**
     * @dev Place a bet on a market
     */
    function placeBet(
        bytes32 _marketId,
        uint8 _option
    ) external payable nonReentrant {
        Market storage market = markets[_marketId];
        
        require(market.marketId != bytes32(0), "Market does not exist");
        require(market.status == MarketStatus.ACTIVE, "Market not active");
        require(_option <= 1, "Invalid option");
        require(msg.value >= minBetAmount, "Bet too small");
        require(msg.value <= maxBetAmount, "Bet too large");
        
        Bet memory newBet = Bet({
            bettor: msg.sender,
            marketId: _marketId,
            option: _option,
            amount: msg.value,
            timestamp: block.timestamp,
            claimed: false
        });
        
        uint256 betIndex = marketBets[_marketId].length;
        marketBets[_marketId].push(newBet);
        userBets[msg.sender].push(_marketId);
        userBetIndices[_marketId][msg.sender].push(betIndex);
        
        // Update pools
        market.optionPools[_option] += msg.value;
        market.totalPool += msg.value;
        
        emit BetPlaced(
            _marketId,
            msg.sender,
            _option,
            msg.value,
            block.timestamp
        );
    }
    
    /**
     * @dev Resolve a market (called by authorized resolver after SDS event)
     */
    function resolveMarket(
        bytes32 _marketId,
        uint8 _winningOption
    ) external onlyResolver {
        Market storage market = markets[_marketId];

        require(market.marketId != bytes32(0), "Market does not exist");
        require(market.status == MarketStatus.ACTIVE, "Market not active");
        require(_winningOption <= 1, "Invalid winning option");
        require(block.timestamp >= market.resolutionTime, "Too early to resolve");

        market.status = MarketStatus.RESOLVED;
        market.winningOption = _winningOption;

        emit MarketResolved(
            _marketId,
            _winningOption,
            market.totalPool,
            block.timestamp
        );
    }
    
    /**
     * @dev Claim winnings for a resolved market
     */
    function claimWinnings(bytes32 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        
        require(market.status == MarketStatus.RESOLVED, "Market not resolved");
        
        uint256[] memory betIndices = userBetIndices[_marketId][msg.sender];
        require(betIndices.length > 0, "No bets found");
        
        uint256 totalWinnings = 0;
        
        for (uint256 i = 0; i < betIndices.length; i++) {
            Bet storage bet = marketBets[_marketId][betIndices[i]];
            
            if (!bet.claimed && bet.option == market.winningOption) {
                bet.claimed = true;

                // Calculate winnings proportionally
                uint256 winningPool = market.optionPools[market.winningOption];

                if (winningPool > 0) {
                    // More accurate calculation: winnings = (bet.amount * totalPool) / winningPool
                    uint256 grossWinnings = (bet.amount * market.totalPool) / winningPool;

                    // Deduct platform fee from profit only
                    uint256 profit = grossWinnings > bet.amount ? grossWinnings - bet.amount : 0;
                    uint256 fee = (profit * platformFee) / BASIS_POINTS;
                    uint256 payout = grossWinnings - fee;

                    totalWinnings += payout;
                    collectedFees += fee;
                }
            }
        }
        
        require(totalWinnings > 0, "No winnings to claim");
        
        (bool success, ) = payable(msg.sender).call{value: totalWinnings}("");
        require(success, "Transfer failed");
        
        emit WinningsClaimed(_marketId, msg.sender, totalWinnings);
    }
    
    /**
     * @dev Cancel market and refund all bets (emergency function)
     */
    function cancelMarket(bytes32 _marketId) external {
        Market storage market = markets[_marketId];
        
        require(market.marketId != bytes32(0), "Market does not exist");
        require(
            msg.sender == market.creator || msg.sender == owner(),
            "Not authorized"
        );
        require(
            market.status == MarketStatus.ACTIVE,
            "Market not active"
        );
        
        market.status = MarketStatus.CANCELLED;
        
        emit MarketCancelled(_marketId);
    }
    
    /**
     * @dev Refund bets for cancelled market
     */
    function refundBets(bytes32 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        
        require(market.status == MarketStatus.CANCELLED, "Market not cancelled");
        
        uint256[] memory betIndices = userBetIndices[_marketId][msg.sender];
        require(betIndices.length > 0, "No bets found");
        
        uint256 totalRefund = 0;
        
        for (uint256 i = 0; i < betIndices.length; i++) {
            Bet storage bet = marketBets[_marketId][betIndices[i]];
            
            if (!bet.claimed) {
                bet.claimed = true;
                totalRefund += bet.amount;
            }
        }
        
        require(totalRefund > 0, "No refunds available");
        
        (bool success, ) = payable(msg.sender).call{value: totalRefund}("");
        require(success, "Refund failed");
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
     * @dev Get user's bets for a market
     */
    function getUserMarketBets(
        bytes32 _marketId,
        address _user
    ) external view returns (Bet[] memory) {
        uint256[] memory indices = userBetIndices[_marketId][_user];
        Bet[] memory bets = new Bet[](indices.length);
        
        for (uint256 i = 0; i < indices.length; i++) {
            bets[i] = marketBets[_marketId][indices[i]];
        }
        
        return bets;
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
    function getOdds(bytes32 _marketId) external view returns (uint256[2] memory) {
        Market memory market = markets[_marketId];
        
        if (market.totalPool == 0) {
            return [uint256(2 * BASIS_POINTS), uint256(2 * BASIS_POINTS)]; // 2x for both
        }
        
        uint256[2] memory odds;
        
        for (uint8 i = 0; i < 2; i++) {
            if (market.optionPools[i] > 0) {
                odds[i] = (market.totalPool * BASIS_POINTS) / market.optionPools[i];
            } else {
                odds[i] = 0;
            }
        }
        
        return odds;
    }
    
    /**
     * @dev Admin: Set or update authorized resolver
     */
    function setResolver(address _resolver, bool _authorized) external onlyOwner {
        require(_resolver != address(0), "Invalid resolver address");
        authorizedResolvers[_resolver] = _authorized;
        emit ResolverUpdated(_resolver, _authorized);
    }

    /**
     * @dev Admin: Update platform fee
     */
    function setPlatformFee(uint256 _fee) external onlyOwner {
        require(_fee <= 1000, "Fee too high"); // Max 10%
        uint256 oldFee = platformFee;
        platformFee = _fee;
        emit PlatformFeeUpdated(oldFee, _fee);
    }

    /**
     * @dev Admin: Update bet limits
     */
    function setBetLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min < _max, "Invalid limits");
        minBetAmount = _min;
        maxBetAmount = _max;
        emit BetLimitsUpdated(_min, _max);
    }

    /**
     * @dev Admin: Withdraw collected platform fees only
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = collectedFees;
        require(amount > 0, "No fees to withdraw");

        collectedFees = 0;

        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Withdrawal failed");

        emit FeesWithdrawn(owner(), amount);
    }
    
    receive() external payable {}
}