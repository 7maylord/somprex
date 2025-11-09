// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BossBattleGame
 * @dev Simple boss battle game that emits events via Somnia Data Streams
 * These events can be used by prediction markets
 */
contract BossBattleGame {
    
    struct GameSession {
        bytes32 sessionId;
        address player;
        uint256 startTime;
        uint256 endTime;
        uint8 bossLevel;
        bool defeated;
        uint256 damageDealt;
        uint256 timeTaken;
    }
    
    struct Player {
        address playerAddress;
        uint256 totalGames;
        uint256 victories;
        uint8 currentLevel;
    }
    
    // State
    mapping(bytes32 => GameSession) public gameSessions;
    mapping(address => Player) public players;
    mapping(address => bytes32[]) public playerSessions;
    
    bytes32[] public allSessions;
    
    uint256 public constant BOSS_HP = 1000;
    uint256 public constant TIME_LIMIT = 120; // 2 minutes
    
    // Events for SDS integration
    event GameStarted(
        bytes32 indexed sessionId,
        address indexed player,
        uint256 startTime,
        uint8 bossLevel
    );
    
    event DamageDealt(
        bytes32 indexed sessionId,
        address indexed player,
        uint256 damage,
        uint256 timestamp
    );
    
    event BossDefeated(
        bytes32 indexed sessionId,
        address indexed player,
        uint256 timeTaken,
        uint256 totalDamage
    );
    
    event GameFailed(
        bytes32 indexed sessionId,
        address indexed player,
        string reason
    );
    
    event PlayerLevelUp(
        address indexed player,
        uint8 newLevel,
        uint256 timestamp
    );
    
    /**
     * @dev Start a new game session
     */
    function startGame(uint8 _bossLevel) external returns (bytes32) {
        require(_bossLevel >= 1 && _bossLevel <= 10, "Invalid boss level");

        // Use nonce for better entropy and prevent prediction
        bytes32 sessionId = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp,
                block.number,
                block.prevrandao, // Use prevrandao for better randomness
                players[msg.sender].totalGames
            )
        );
        
        // Initialize player if new
        if (players[msg.sender].playerAddress == address(0)) {
            players[msg.sender] = Player({
                playerAddress: msg.sender,
                totalGames: 0,
                victories: 0,
                currentLevel: 1
            });
        }
        
        GameSession memory newSession = GameSession({
            sessionId: sessionId,
            player: msg.sender,
            startTime: block.timestamp,
            endTime: 0,
            bossLevel: _bossLevel,
            defeated: false,
            damageDealt: 0,
            timeTaken: 0
        });
        
        gameSessions[sessionId] = newSession;
        playerSessions[msg.sender].push(sessionId);
        allSessions.push(sessionId);
        
        players[msg.sender].totalGames++;
        
        emit GameStarted(sessionId, msg.sender, block.timestamp, _bossLevel);
        
        return sessionId;
    }
    
    /**
     * @dev Record damage dealt to boss
     */
    function dealDamage(bytes32 _sessionId, uint256 _damage) external {
        GameSession storage session = gameSessions[_sessionId];

        require(session.player == msg.sender, "Not your session");
        require(session.sessionId != bytes32(0), "Session does not exist");
        require(!session.defeated, "Boss already defeated");
        require(session.endTime == 0, "Game already ended");
        require(
            block.timestamp <= session.startTime + TIME_LIMIT,
            "Time limit exceeded"
        );
        require(_damage > 0, "Damage must be greater than 0");
        require(_damage <= 200, "Damage too high per hit"); // Anti-cheat: max damage per hit

        session.damageDealt += _damage;
        
        emit DamageDealt(_sessionId, msg.sender, _damage, block.timestamp);
        
        // Check if boss is defeated
        if (session.damageDealt >= BOSS_HP) {
            _defeatBoss(_sessionId);
        }
    }
    
    /**
     * @dev Internal: Handle boss defeat
     */
    function _defeatBoss(bytes32 _sessionId) internal {
        GameSession storage session = gameSessions[_sessionId];
        
        session.defeated = true;
        session.endTime = block.timestamp;
        session.timeTaken = session.endTime - session.startTime;
        
        Player storage player = players[msg.sender];
        player.victories++;
        
        // Level up every 3 victories
        if (player.victories % 3 == 0) {
            player.currentLevel++;
            emit PlayerLevelUp(msg.sender, player.currentLevel, block.timestamp);
        }
        
        emit BossDefeated(
            _sessionId,
            msg.sender,
            session.timeTaken,
            session.damageDealt
        );
    }
    
    /**
     * @dev End game session (timeout or give up)
     */
    function endGame(bytes32 _sessionId) external {
        GameSession storage session = gameSessions[_sessionId];
        
        require(session.player == msg.sender, "Not your session");
        require(!session.defeated, "Boss already defeated");
        require(session.endTime == 0, "Game already ended");
        
        session.endTime = block.timestamp;
        
        string memory reason;
        if (block.timestamp > session.startTime + TIME_LIMIT) {
            reason = "Time limit exceeded";
        } else {
            reason = "Player gave up";
        }
        
        emit GameFailed(_sessionId, msg.sender, reason);
    }
    
    /**
     * @dev Get game session details
     */
    function getSession(bytes32 _sessionId) external view returns (GameSession memory) {
        return gameSessions[_sessionId];
    }
    
    /**
     * @dev Get player stats
     */
    function getPlayerStats(address _player) external view returns (Player memory) {
        return players[_player];
    }
    
    /**
     * @dev Get all sessions for a player
     */
    function getPlayerSessions(address _player) external view returns (bytes32[] memory) {
        return playerSessions[_player];
    }
    
    /**
     * @dev Get all game sessions
     */
    function getAllSessions() external view returns (bytes32[] memory) {
        return allSessions;
    }
    
    /**
     * @dev Check if game is still active
     */
    function isGameActive(bytes32 _sessionId) external view returns (bool) {
        GameSession memory session = gameSessions[_sessionId];
        
        if (session.defeated || session.endTime != 0) {
            return false;
        }
        
        if (block.timestamp > session.startTime + TIME_LIMIT) {
            return false;
        }
        
        return true;
    }
}