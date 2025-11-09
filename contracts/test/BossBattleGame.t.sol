// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BossBattleGame.sol";

contract BossBattleGameTest is Test {
    BossBattleGame public game;

    address player1 = address(1);
    address player2 = address(2);
    address player3 = address(3);

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

    function setUp() public {
        game = new BossBattleGame();
    }

    /* ============ Starting Games Tests ============ */

    function test_StartGame_Success() public {
        uint8 bossLevel = 5;

        vm.prank(player1);
        vm.expectEmit(false, true, false, false);
        emit GameStarted(bytes32(0), player1, block.timestamp, bossLevel);
        bytes32 sessionId = game.startGame(bossLevel);

        BossBattleGame.GameSession memory session = game.getSession(sessionId);
        assertEq(session.player, player1);
        assertEq(session.bossLevel, bossLevel);
        assertFalse(session.defeated);
        assertEq(session.damageDealt, 0);
    }

    function test_StartGame_InitializesNewPlayer() public {
        vm.prank(player1);
        game.startGame(5);

        BossBattleGame.Player memory player = game.getPlayerStats(player1);
        assertEq(player.playerAddress, player1);
        assertEq(player.totalGames, 1);
        assertEq(player.victories, 0);
        assertEq(player.currentLevel, 1);
    }

    function test_StartGame_IncrementsGameCount() public {
        vm.startPrank(player1);
        game.startGame(5);
        game.startGame(3);
        vm.stopPrank();

        BossBattleGame.Player memory player = game.getPlayerStats(player1);
        assertEq(player.totalGames, 2);
    }

    function test_StartGame_RevertWhen_InvalidLevel() public {
        vm.startPrank(player1);

        vm.expectRevert("Invalid boss level");
        game.startGame(0);

        vm.expectRevert("Invalid boss level");
        game.startGame(11);

        vm.stopPrank();
    }

    function test_StartGame_GeneratesUniqueSessionIds() public {
        vm.startPrank(player1);
        bytes32 sessionId1 = game.startGame(5);
        bytes32 sessionId2 = game.startGame(5);
        vm.stopPrank();

        assertTrue(sessionId1 != sessionId2);
    }

    /* ============ Dealing Damage Tests ============ */

    function test_DealDamage_Success() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        uint256 damage = 100;

        vm.prank(player1);
        vm.expectEmit(true, true, false, true);
        emit DamageDealt(sessionId, player1, damage, block.timestamp);
        game.dealDamage(sessionId, damage);

        BossBattleGame.GameSession memory session = game.getSession(sessionId);
        assertEq(session.damageDealt, damage);
    }

    function test_DealDamage_AccumulatesOverMultipleHits() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.startPrank(player1);
        game.dealDamage(sessionId, 100);
        game.dealDamage(sessionId, 150);
        game.dealDamage(sessionId, 200);
        vm.stopPrank();

        BossBattleGame.GameSession memory session = game.getSession(sessionId);
        assertEq(session.damageDealt, 450);
    }

    function test_DealDamage_RevertWhen_ZeroDamage() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.prank(player1);
        vm.expectRevert("Damage must be greater than 0");
        game.dealDamage(sessionId, 0);
    }

    function test_DealDamage_RevertWhen_ExcessiveDamage() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.prank(player1);
        vm.expectRevert("Damage too high per hit");
        game.dealDamage(sessionId, 201);
    }

    function test_DealDamage_RevertWhen_WrongPlayer() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.prank(player2);
        vm.expectRevert("Not your session");
        game.dealDamage(sessionId, 100);
    }

    function test_DealDamage_RevertWhen_NonExistentSession() public {
        bytes32 fakeSessionId = keccak256("fake");

        vm.prank(player1);
        vm.expectRevert("Not your session");
        game.dealDamage(fakeSessionId, 100);
    }

    function test_DealDamage_RevertWhen_TimeExpired() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.warp(block.timestamp + 121);

        vm.prank(player1);
        vm.expectRevert("Time limit exceeded");
        game.dealDamage(sessionId, 100);
    }

    function test_DealDamage_RevertWhen_BossAlreadyDefeated() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        // Defeat boss
        vm.startPrank(player1);
        for (uint i = 0; i < 5; i++) {
            game.dealDamage(sessionId, 200);
        }

        vm.expectRevert("Boss already defeated");
        game.dealDamage(sessionId, 100);
        vm.stopPrank();
    }

    /* ============ Defeating Boss Tests ============ */

    function test_DefeatBoss_At1000Damage() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.startPrank(player1);
        game.dealDamage(sessionId, 200);
        game.dealDamage(sessionId, 200);
        game.dealDamage(sessionId, 200);
        game.dealDamage(sessionId, 200);

        vm.expectEmit(true, true, false, false);
        emit BossDefeated(sessionId, player1, 0, 1000);
        game.dealDamage(sessionId, 200);
        vm.stopPrank();

        BossBattleGame.GameSession memory session = game.getSession(sessionId);
        assertTrue(session.defeated);
        assertTrue(session.endTime > 0);
    }

    function test_DefeatBoss_UpdatesVictories() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.startPrank(player1);
        for (uint i = 0; i < 5; i++) {
            game.dealDamage(sessionId, 200);
        }
        vm.stopPrank();

        BossBattleGame.Player memory player = game.getPlayerStats(player1);
        assertEq(player.victories, 1);
    }

    function test_DefeatBoss_LevelUpEvery3Victories() public {
        // Win 3 games
        for (uint j = 0; j < 3; j++) {
            vm.prank(player1);
            bytes32 sessionId = game.startGame(5);

            vm.startPrank(player1);
            for (uint i = 0; i < 5; i++) {
                game.dealDamage(sessionId, 200);
            }
            vm.stopPrank();
        }

        BossBattleGame.Player memory player = game.getPlayerStats(player1);
        assertEq(player.victories, 3);
        assertEq(player.currentLevel, 2);
    }

    function test_DefeatBoss_EmitsLevelUpEvent() public {
        // Win first 2 games
        for (uint j = 0; j < 2; j++) {
            vm.prank(player1);
            bytes32 sessionId = game.startGame(5);

            vm.startPrank(player1);
            for (uint i = 0; i < 5; i++) {
                game.dealDamage(sessionId, 200);
            }
            vm.stopPrank();
        }

        // Win 3rd game - should trigger level up
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.startPrank(player1);
        for (uint i = 0; i < 4; i++) {
            game.dealDamage(sessionId, 200);
        }

        vm.expectEmit(true, false, false, true);
        emit PlayerLevelUp(player1, 2, block.timestamp);
        game.dealDamage(sessionId, 200);
        vm.stopPrank();
    }

    /* ============ Ending Games Tests ============ */

    function test_EndGame_PlayerGivesUp() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.prank(player1);
        vm.expectEmit(true, true, false, true);
        emit GameFailed(sessionId, player1, "Player gave up");
        game.endGame(sessionId);

        BossBattleGame.GameSession memory session = game.getSession(sessionId);
        assertTrue(session.endTime > 0);
        assertFalse(session.defeated);
    }

    function test_EndGame_Timeout() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.warp(block.timestamp + 121);

        vm.prank(player1);
        vm.expectEmit(true, true, false, true);
        emit GameFailed(sessionId, player1, "Time limit exceeded");
        game.endGame(sessionId);
    }

    function test_EndGame_RevertWhen_WrongPlayer() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.prank(player2);
        vm.expectRevert("Not your session");
        game.endGame(sessionId);
    }

    function test_EndGame_RevertWhen_BossAlreadyDefeated() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.startPrank(player1);
        for (uint i = 0; i < 5; i++) {
            game.dealDamage(sessionId, 200);
        }

        vm.expectRevert("Boss already defeated");
        game.endGame(sessionId);
        vm.stopPrank();
    }

    function test_EndGame_RevertWhen_AlreadyEnded() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.startPrank(player1);
        game.endGame(sessionId);

        vm.expectRevert("Game already ended");
        game.endGame(sessionId);
        vm.stopPrank();
    }

    /* ============ View Functions Tests ============ */

    function test_GetSession() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        BossBattleGame.GameSession memory session = game.getSession(sessionId);
        assertEq(session.player, player1);
        assertEq(session.bossLevel, 5);
    }

    function test_GetPlayerStats() public {
        vm.prank(player1);
        game.startGame(5);

        BossBattleGame.Player memory player = game.getPlayerStats(player1);
        assertEq(player.playerAddress, player1);
        assertEq(player.totalGames, 1);
    }

    function test_GetPlayerSessions() public {
        vm.startPrank(player1);
        game.startGame(5);
        game.startGame(3);
        game.startGame(7);
        vm.stopPrank();

        bytes32[] memory sessions = game.getPlayerSessions(player1);
        assertEq(sessions.length, 3);
    }

    function test_GetAllSessions() public {
        vm.prank(player1);
        game.startGame(5);

        vm.prank(player2);
        game.startGame(5);

        vm.prank(player3);
        game.startGame(5);

        bytes32[] memory allSessions = game.getAllSessions();
        assertEq(allSessions.length, 3);
    }

    function test_IsGameActive_ActiveGame() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        assertTrue(game.isGameActive(sessionId));
    }

    function test_IsGameActive_DefeatedBoss() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.startPrank(player1);
        for (uint i = 0; i < 5; i++) {
            game.dealDamage(sessionId, 200);
        }
        vm.stopPrank();

        assertFalse(game.isGameActive(sessionId));
    }

    function test_IsGameActive_Timeout() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        assertTrue(game.isGameActive(sessionId));

        vm.warp(block.timestamp + 121);

        assertFalse(game.isGameActive(sessionId));
    }

    function test_IsGameActive_EndedManually() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.prank(player1);
        game.endGame(sessionId);

        assertFalse(game.isGameActive(sessionId));
    }

    /* ============ Multiple Players Tests ============ */

    function test_MultiplePlayersSimultaneous() public {
        vm.prank(player1);
        game.startGame(5);

        vm.prank(player2);
        game.startGame(3);

        vm.prank(player3);
        game.startGame(7);

        bytes32[] memory allSessions = game.getAllSessions();
        assertEq(allSessions.length, 3);

        BossBattleGame.Player memory p1 = game.getPlayerStats(player1);
        BossBattleGame.Player memory p2 = game.getPlayerStats(player2);
        BossBattleGame.Player memory p3 = game.getPlayerStats(player3);

        assertEq(p1.totalGames, 1);
        assertEq(p2.totalGames, 1);
        assertEq(p3.totalGames, 1);
    }

    function test_MultiplePlayersSeparateProgress() public {
        // Player 1 wins 3 games
        for (uint j = 0; j < 3; j++) {
            vm.prank(player1);
            bytes32 sessionId = game.startGame(5);

            vm.startPrank(player1);
            for (uint i = 0; i < 5; i++) {
                game.dealDamage(sessionId, 200);
            }
            vm.stopPrank();
        }

        // Player 2 wins 1 game
        vm.prank(player2);
        bytes32 sessionId2 = game.startGame(5);

        vm.startPrank(player2);
        for (uint i = 0; i < 5; i++) {
            game.dealDamage(sessionId2, 200);
        }
        vm.stopPrank();

        BossBattleGame.Player memory p1 = game.getPlayerStats(player1);
        BossBattleGame.Player memory p2 = game.getPlayerStats(player2);

        assertEq(p1.victories, 3);
        assertEq(p1.currentLevel, 2);
        assertEq(p2.victories, 1);
        assertEq(p2.currentLevel, 1);
    }

    /* ============ Constants Tests ============ */

    function test_Constants() public {
        assertEq(game.BOSS_HP(), 1000);
        assertEq(game.TIME_LIMIT(), 120);
    }

    /* ============ Fuzz Tests ============ */

    function testFuzz_DealDamage(uint256 damage) public {
        damage = bound(damage, 1, 200);

        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.prank(player1);
        game.dealDamage(sessionId, damage);

        BossBattleGame.GameSession memory session = game.getSession(sessionId);
        assertEq(session.damageDealt, damage);
    }

    function testFuzz_StartGame_ValidLevels(uint8 level) public {
        level = uint8(bound(level, 1, 10));

        vm.prank(player1);
        bytes32 sessionId = game.startGame(level);

        BossBattleGame.GameSession memory session = game.getSession(sessionId);
        assertEq(session.bossLevel, level);
    }

    /* ============ Gas Tests ============ */

    function test_Gas_StartGame() public {
        vm.prank(player1);
        game.startGame(5);
    }

    function test_Gas_DealDamage() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.prank(player1);
        game.dealDamage(sessionId, 100);
    }

    function test_Gas_DefeatBoss() public {
        vm.prank(player1);
        bytes32 sessionId = game.startGame(5);

        vm.startPrank(player1);
        for (uint i = 0; i < 5; i++) {
            game.dealDamage(sessionId, 200);
        }
        vm.stopPrank();
    }
}
