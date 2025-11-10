const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment to Somnia Testnet...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying contracts with account:", deployer.address);

  // Get account balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.utils.formatEther(balance), "SOMI\n");

  // 1. Deploy SOMI Token
  console.log("📝 Deploying SomiToken...");
  const SomiToken = await hre.ethers.getContractFactory("SomiToken");
  const somiToken = await SomiToken.deploy();
  await somiToken.deployed();
  const somiAddress = somiToken.address;
  console.log("✅ SomiToken deployed to:", somiAddress);

  // Check initial supply
  const totalSupply = await somiToken.totalSupply();
  console.log("   Initial supply:", hre.ethers.utils.formatEther(totalSupply), "SOMI");
  console.log("   Owner balance:", hre.ethers.utils.formatEther(await somiToken.balanceOf(deployer.address)), "SOMI\n");

  // 2. Deploy PredictionMarket
  console.log("📝 Deploying PredictionMarket...");
  const PredictionMarket = await hre.ethers.getContractFactory("PredictionMarket");
  const predictionMarket = await PredictionMarket.deploy(somiAddress);
  await predictionMarket.deployed();
  const marketAddress = predictionMarket.address;
  console.log("✅ PredictionMarket deployed to:", marketAddress);

  // Verify deployer is authorized resolver
  const isAuthorized = await predictionMarket.authorizedResolvers(deployer.address);
  console.log("   Deployer is authorized resolver:", isAuthorized, "\n");

  // 3. Deploy BossBattleGame (if needed)
  console.log("📝 Deploying BossBattleGame...");
  const BossBattleGame = await hre.ethers.getContractFactory("BossBattleGame");
  const game = await BossBattleGame.deploy();
  await game.deployed();
  const gameAddress = game.address;
  console.log("✅ BossBattleGame deployed to:", gameAddress, "\n");

  // Summary
  console.log("=" .repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(60));
  console.log("\n📋 Contract Addresses:\n");
  console.log("SomiToken:           ", somiAddress);
  console.log("PredictionMarket:  ", marketAddress);
  console.log("BossBattleGame:      ", gameAddress);
  console.log("\n" + "=" .repeat(60));

  console.log("\n📝 Next Steps:\n");
  console.log("1. Update frontend .env file:");
  console.log(`   NEXT_PUBLIC_SOMI_TOKEN=${somiAddress}`);
  console.log(`   NEXT_PUBLIC_MARKET_CONTRACT=${marketAddress}`);
  console.log(`   NEXT_PUBLIC_GAME_CONTRACT=${gameAddress}`);

  console.log("\n2. Test faucet functionality:");
  console.log("   - Users can call claimFromFaucet() to get 100 SOMI");
  console.log("   - Cooldown: 1 day between claims");

  console.log("\n3. Update ABIs:");
  console.log("   cd ../frontend && yarn extract-abis");

  console.log("\n4. Verify contracts on explorer:");
  console.log("   https://shannon-explorer.somnia.network/address/" + somiAddress);
  console.log("   https://shannon-explorer.somnia.network/address/" + marketAddress);
  console.log("\n" + "=" .repeat(60) + "\n");

  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    network: "somnia_testnet",
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      SomiToken: somiAddress,
      PredictionMarket: marketAddress,
      BossBattleGame: gameAddress
    },
    config: {
      faucetAmount: "100 SOMI",
      faucetCooldown: "1 day",
      minBetAmount: "0.01 SOMI",
      maxBetAmount: "100 SOMI",
      platformFee: "2%"
    }
  };

  fs.writeFileSync(
    './deployments/v2-deployment.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("💾 Deployment info saved to deployments/v2-deployment.json\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
