// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/PredictionMarket.sol";
import "../src/BossBattleGame.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy PredictionMarket
        PredictionMarket predictionMarket = new PredictionMarket();
        console.log("PredictionMarket deployed to:", address(predictionMarket));

        // Deploy BossBattleGame
        BossBattleGame bossBattleGame = new BossBattleGame();
        console.log("BossBattleGame deployed to:", address(bossBattleGame));

        vm.stopBroadcast();

        console.log("\nDeployment Summary:");
        console.log("===================");
        console.log("Network: Somnia Testnet");
        console.log("PredictionMarket:", address(predictionMarket));
        console.log("BossBattleGame:", address(bossBattleGame));
    }
}
