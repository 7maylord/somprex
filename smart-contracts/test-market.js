const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log("Testing with account:", signer.address);

  const contractAddress = "0x0a38B5875F21ba86e6fF699c8A19df2411F55e17";
  const PredictionMarket = await hre.ethers.getContractAt("PredictionMarket", contractAddress);

  // Generate test market ID
  const marketId = hre.ethers.utils.keccak256(
    hre.ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256", "string"],
      [signer.address, Math.floor(Date.now() / 1000), "Test Market"]
    )
  );

  const marketType = 0; // BLOCK
  const question = "Will the next block have more than 100 transactions?";
  const resolutionTime = Math.floor(Date.now() / 1000) + (24 * 3600); // 24 hours from now
  const dataSourceId = "0x0000000000000000000000000000000000000000000000000000000000000000";

  console.log("\nTest Parameters:");
  console.log("MarketId:", marketId);
  console.log("Question:", question);
  console.log("Resolution Time:", resolutionTime, "(" + new Date(resolutionTime * 1000).toISOString() + ")");
  console.log("Current Time:", Math.floor(Date.now() / 1000));

  try {
    // Estimate gas
    console.log("\n=== Estimating Gas ===");
    const gasEstimate = await PredictionMarket.estimateGas.createMarket(
      marketId,
      marketType,
      question,
      resolutionTime,
      dataSourceId
    );
    console.log("Estimated Gas:", gasEstimate.toString());
    console.log("With 20% buffer:", Math.floor(gasEstimate.toNumber() * 1.2));

    // Try to create market
    console.log("\n=== Creating Market ===");
    const tx = await PredictionMarket.createMarket(
      marketId,
      marketType,
      question,
      resolutionTime,
      dataSourceId,
      {
        gasLimit: Math.floor(gasEstimate.toNumber() * 1.2) // 20% buffer
      }
    );

    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed!");
    console.log("Gas Used:", receipt.gasUsed.toString());
    console.log("Block:", receipt.blockNumber);

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.reason) console.error("Reason:", error.reason);
    if (error.code) console.error("Code:", error.code);
    if (error.data) console.error("Data:", error.data);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
