const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n========================================");
  console.log("  PREDEX - SOMNIA TESTNET DEPLOYMENT");
  console.log("========================================\n");

  // Get deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  const balance = await deployer.getBalance();
  console.log("Account balance:", hre.ethers.utils.formatEther(balance), "SOMI");

  const network = await hre.ethers.provider.getNetwork();
  console.log("Chain ID:", network.chainId);
  console.log("========================================\n");

  // Deploy PredictionMarket
  console.log("[1/2] Deploying PredictionMarket...");
  const PredictionMarket = await hre.ethers.getContractFactory("PredictionMarket");
  const predictionMarket = await PredictionMarket.deploy();
  await predictionMarket.deployed();
  console.log("      PredictionMarket deployed at:", predictionMarket.address, "\n");

  // Deploy BossBattleGame
  console.log("[2/2] Deploying BossBattleGame...");
  const BossBattleGame = await hre.ethers.getContractFactory("BossBattleGame");
  const bossBattleGame = await BossBattleGame.deploy();
  await bossBattleGame.deployed();
  console.log("      BossBattleGame deployed at:", bossBattleGame.address, "\n");

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      PredictionMarket: {
        address: predictionMarket.address,
      },
      BossBattleGame: {
        address: bossBattleGame.address,
      },
    },
  };

  // Save to file
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(
    deploymentsDir,
    `somnia-testnet-${Date.now()}.json`
  );
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  // Also save latest deployment
  const latestFile = path.join(deploymentsDir, `somnia-testnet-latest.json`);
  fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("💾 Deployment info saved to:", deploymentFile);
  console.log();

  // Print Summary
  console.log("========================================");
  console.log("  DEPLOYMENT COMPLETE!");
  console.log("========================================\n");

  console.log("==> Contract Addresses:");
  console.log("PREDICTION_MARKET_ADDRESS=", predictionMarket.address);
  console.log("BOSS_BATTLE_GAME_ADDRESS=", bossBattleGame.address);

  console.log("\n========================================");
  console.log("  NEXT STEPS:");
  console.log("========================================");
  console.log("1. Update frontend .env with contract addresses");
  console.log("2. Verify contracts on Somnia Explorer");
  console.log("3. Test contract interactions");
  console.log("\nExplorer: https://shannon-explorer.somnia.network/");
  console.log("========================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
