// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SomiToken
 * @dev ERC20 token for testing PredEx prediction markets
 * @notice This is a test token with minting capabilities for development
 */
contract SomiToken is ERC20, Ownable {

    uint8 private _decimals = 18;

    // Faucet configuration
    uint256 public faucetAmount = 100 * 10**18; // 100 SOMI per claim
    uint256 public faucetCooldown = 1 days;
    mapping(address => uint256) public lastFaucetClaim;

    event FaucetClaimed(address indexed claimer, uint256 amount);
    event FaucetAmountUpdated(uint256 newAmount);
    event FaucetCooldownUpdated(uint256 newCooldown);

    constructor() ERC20("Somi Test Token", "SOMI") Ownable(msg.sender) {
        // Mint initial supply to deployer (1 million tokens)
        _mint(msg.sender, 1_000_000 * 10**18);
    }

    /**
     * @dev Returns the number of decimals used for token amounts
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mint new tokens (public - anyone can mint for testing)
     * @param to Address to receive tokens
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @dev Faucet function - allows users to claim test tokens
     */
    function claimFromFaucet() external {
        require(
            block.timestamp >= lastFaucetClaim[msg.sender] + faucetCooldown,
            "Faucet cooldown active"
        );

        lastFaucetClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, faucetAmount);

        emit FaucetClaimed(msg.sender, faucetAmount);
    }

    /**
     * @dev Update faucet amount (only owner)
     */
    function setFaucetAmount(uint256 _amount) external onlyOwner {
        faucetAmount = _amount;
        emit FaucetAmountUpdated(_amount);
    }

    /**
     * @dev Update faucet cooldown (only owner)
     */
    function setFaucetCooldown(uint256 _cooldown) external onlyOwner {
        faucetCooldown = _cooldown;
        emit FaucetCooldownUpdated(_cooldown);
    }

    /**
     * @dev Check if address can claim from faucet
     */
    function canClaimFromFaucet(address account) external view returns (bool) {
        return block.timestamp >= lastFaucetClaim[account] + faucetCooldown;
    }

    /**
     * @dev Get time until next faucet claim
     */
    function timeUntilNextClaim(address account) external view returns (uint256) {
        uint256 nextClaimTime = lastFaucetClaim[account] + faucetCooldown;
        if (block.timestamp >= nextClaimTime) {
            return 0;
        }
        return nextClaimTime - block.timestamp;
    }
}
