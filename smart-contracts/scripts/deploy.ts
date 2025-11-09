const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying contracts to Somnia Testnet...\n");

  // Get deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());
  console.log();

  // Deploy PredictionMarket
  console.log("📝 Deploying PredictionMarket...");
  const PredictionMarket = await hre.ethers.getContractFactory("PredictionMarket");
  const predictionMarket = await PredictionMarket.deploy();
  await predictionMarket.waitForDeployment();
  const predictionMarketAddress = await predictionMarket.getAddress();
  
  console.log("✅ PredictionMarket deployed to:", predictionMarketAddress);
  console.log();

  // Deploy BossBattleGame
  console.log("🎮 Deploying BossBattleGame...");
  const BossBattleGame = await hre.ethers.getContractFactory("BossBattleGame");
  const bossBattleGame = await BossBattleGame.deploy();
  await bossBattleGame.waitForDeployment();
  const bossBattleGameAddress = await bossBattleGame.getAddress();
  
  console.log("✅ BossBattleGame deployed to:", bossBattleGameAddress);
  console.log();

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      PredictionMarket: {
        address: predictionMarketAddress,
        blockNumber: predictionMarket.deploymentTransaction()?.blockNumber,
      },
      BossBattleGame: {
        address: bossBattleGameAddress,
        blockNumber: bossBattleGame.deploymentTransaction()?.blockNumber,
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
    `${hre.network.name}-${Date.now()}.json`
  );
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  // Also save latest deployment
  const latestFile = path.join(deploymentsDir, `${hre.network.name}-latest.json`);
  fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("💾 Deployment info saved to:", deploymentFile);
  console.log();

  // Print summary
  console.log("📋 Deployment Summary:");
  console.log("======================");
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", hre.network.config.chainId);
  console.log("Deployer:", deployer.address);
  console.log();
  console.log("Contracts:");
  console.log("  PredictionMarket:", predictionMarketAddress);
  console.log("  BossBattleGame:  ", bossBattleGameAddress);
  console.log();
  console.log("✅ Deployment complete!");
  console.log();
  console.log("Next steps:");
  console.log("1. Verify contracts on block explorer (if available)");
  console.log("2. Update frontend with contract addresses");
  console.log("3. Test contract interactions");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });