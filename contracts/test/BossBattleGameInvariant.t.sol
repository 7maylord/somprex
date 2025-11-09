// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BossBattleGame.sol";

contract BossBattleGameInvariantTest is Test {
    BossBattleGame public game;

    address[] public players;

    uint256 public ghost_totalGamesStarted;
    uint256 public ghost_totalGamesWon;
    uint256 public ghost_totalDamageDealt;

    constructor() {
        game = new BossBattleGame();

        // Create players
        players.push(makeAddr("player1"));
        players.push(makeAddr("player2"));
        players.push(makeAddr("player3"));

        targetContract(address(this));
    }

    /* ============ State Modifying Functions ============ */

    function startGame(uint256 playerSeed, uint8 bossLevel) public {
        address player = players[playerSeed % players.length];
        bossLevel = uint8(bound(bossLevel, 1, 10));

        vm.prank(player);
        try game.startGame(bossLevel) returns (bytes32) {
            ghost_totalGamesStarted++;
        } catch {
            // Invalid level
        }
    }

    function dealDamage(uint256 playerSeed, uint256 sessionSeed, uint256 damage) public {
        address player = players[playerSeed % players.length];
        bytes32[] memory sessions = game.getPlayerSessions(player);

        if (sessions.length == 0) return;

        bytes32 sessionId = sessions[sessionSeed % sessions.length];
        damage = bound(damage, 1, 200);

        vm.prank(player);
        try game.dealDamage(sessionId, damage) {
            ghost_totalDamageDealt += damage;

            BossBattleGame.GameSession memory session = game.getSession(sessionId);
            if (session.defeated) {
                ghost_totalGamesWon++;
            }
        } catch {
            // Time expired, already defeated, etc
        }
    }

    function endGame(uint256 playerSeed, uint256 sessionSeed) public {
        address player = players[playerSeed % players.length];
        bytes32[] memory sessions = game.getPlayerSessions(player);

        if (sessions.length == 0) return;

        bytes32 sessionId = sessions[sessionSeed % sessions.length];

        vm.prank(player);
        try game.endGame(sessionId) {
            // Game ended
        } catch {
            // Already ended or defeated
        }
    }

    /* ============ Invariants ============ */

    /// @custom:property Boss HP is always 1000
    function invariant_BossHPConstant() public view {
        assertEq(game.BOSS_HP(), 1000, "Boss HP must be 1000");
    }

    /// @custom:property Time limit is always 120 seconds
    function invariant_TimeLimitConstant() public view {
        assertEq(game.TIME_LIMIT(), 120, "Time limit must be 120");
    }

    /// @custom:property Player victories should not exceed total games
    function invariant_VictoriesNotExceedGames() public view {
        for (uint i = 0; i < players.length; i++) {
            BossBattleGame.Player memory player = game.getPlayerStats(players[i]);
            assertTrue(
                player.victories <= player.totalGames,
                "Victories cannot exceed total games"
            );
        }
    }

    /// @custom:property Player level should match victories
    function invariant_LevelMatchesVictories() public view {
        for (uint i = 0; i < players.length; i++) {
            BossBattleGame.Player memory player = game.getPlayerStats(players[i]);
            uint256 expectedLevel = 1 + (player.victories / 3);
            assertEq(
                player.currentLevel,
                expectedLevel,
                "Level should match victories / 3 + 1"
            );
        }
    }

    /// @custom:property Defeated sessions should have damage >= 1000
    function invariant_DefeatedSessionsHaveEnoughDamage() public view {
        bytes32[] memory allSessions = game.getAllSessions();

        for (uint i = 0; i < allSessions.length; i++) {
            BossBattleGame.GameSession memory session = game.getSession(allSessions[i]);

            if (session.defeated) {
                assertTrue(
                    session.damageDealt >= 1000,
                    "Defeated boss must have taken >= 1000 damage"
                );
            }
        }
    }

    /// @custom:property Defeated sessions should have endTime > startTime
    function invariant_DefeatedSessionsHaveValidTimes() public view {
        bytes32[] memory allSessions = game.getAllSessions();

        for (uint i = 0; i < allSessions.length; i++) {
            BossBattleGame.GameSession memory session = game.getSession(allSessions[i]);

            if (session.defeated) {
                assertTrue(
                    session.endTime > session.startTime,
                    "End time must be after start time for defeated sessions"
                );
            }
        }
    }

    /// @custom:property Total victories across all players matches defeated sessions
    function invariant_VictoriesMatchDefeatedSessions() public view {
        uint256 totalVictories = 0;

        for (uint i = 0; i < players.length; i++) {
            BossBattleGame.Player memory player = game.getPlayerStats(players[i]);
            totalVictories += player.victories;
        }

        assertTrue(
            totalVictories == ghost_totalGamesWon,
            "Total victories should match defeated sessions"
        );
    }

    /// @custom:property Active games should have endTime = 0
    function invariant_ActiveGamesHaveNoEndTime() public view {
        bytes32[] memory allSessions = game.getAllSessions();

        for (uint i = 0; i < allSessions.length; i++) {
            BossBattleGame.GameSession memory session = game.getSession(allSessions[i]);

            if (game.isGameActive(allSessions[i])) {
                assertEq(
                    session.endTime,
                    0,
                    "Active games should have endTime = 0"
                );
            }
        }
    }
}
