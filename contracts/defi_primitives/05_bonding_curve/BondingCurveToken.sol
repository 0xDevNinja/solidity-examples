// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title BondingCurveToken
/// @notice Linear bonding curve: instantaneous price = slope * totalSupply.
///         Cost to mint dS extra tokens from supply S is the integral of
///         slope * x dx from S to S+dS = slope * (2*S*dS + dS^2) / 2.
///
///         Quantities are denominated in whole tokens (no decimals applied to the
///         curve math) to keep arithmetic understandable; the ERC20 decimals are 0.
contract BondingCurveToken is ERC20, ReentrancyGuard {
    /// @notice Wei of ETH per (token * token). Price grows linearly with supply.
    uint256 public immutable slope;

    /// @notice ETH locked in the curve, equal to the integral of price from 0 to supply.
    uint256 public reserve;

    event Bought(address indexed buyer, uint256 tokens, uint256 ethIn);
    event Sold(address indexed seller, uint256 tokens, uint256 ethOut);

    constructor(uint256 slope_) ERC20("BondingCurveToken", "BCT") {
        require(slope_ > 0, "zero slope");
        slope = slope_;
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    /// @notice Cost in wei to mint `dS` tokens given current supply `s`.
    /// @dev cost = slope * (2*s*dS + dS^2) / 2
    function _cost(uint256 s, uint256 dS) internal view returns (uint256) {
        return (slope * (2 * s * dS + dS * dS)) / 2;
    }

    /// @notice Refund in wei when burning `dS` tokens given current supply `s`.
    /// @dev refund = slope * (2*s*dS - dS^2) / 2
    function _refund(uint256 s, uint256 dS) internal view returns (uint256) {
        return (slope * (2 * s * dS - dS * dS)) / 2;
    }

    /// @notice Quote how many tokens `ethIn` wei would buy at current supply.
    function quoteBuy(uint256 ethIn) public view returns (uint256 tokensOut) {
        uint256 s = totalSupply();
        // Find the largest dS such that _cost(s, dS) <= ethIn via binary search.
        uint256 lo = 0;
        uint256 hi = ethIn / (slope * (s + 1)) + 1;
        // Expand hi until it overshoots.
        while (_cost(s, hi) <= ethIn) {
            hi *= 2;
        }
        while (lo < hi) {
            uint256 mid = (lo + hi + 1) / 2;
            if (_cost(s, mid) <= ethIn) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        tokensOut = lo;
    }

    /// @notice Buy tokens by sending ETH. Mints the largest whole-token amount
    ///         affordable and refunds dust.
    function buy() external payable nonReentrant {
        require(msg.value > 0, "zero value");
        uint256 s = totalSupply();
        uint256 tokens = quoteBuy(msg.value);
        require(tokens > 0, "insufficient eth");

        uint256 cost = _cost(s, tokens);
        require(cost <= msg.value, "math");
        uint256 refund = msg.value - cost;

        reserve += cost;
        _mint(msg.sender, tokens);

        if (refund > 0) {
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            require(ok, "refund failed");
        }
        emit Bought(msg.sender, tokens, cost);
    }

    /// @notice Sell `tokens` back to the curve and receive ETH.
    function sell(uint256 tokens) external nonReentrant {
        require(tokens > 0, "zero tokens");
        require(balanceOf(msg.sender) >= tokens, "insufficient balance");

        uint256 s = totalSupply();
        uint256 refund = _refund(s, tokens);
        require(refund <= reserve, "reserve broken");

        _burn(msg.sender, tokens);
        reserve -= refund;

        (bool ok, ) = payable(msg.sender).call{value: refund}("");
        require(ok, "transfer failed");
        emit Sold(msg.sender, tokens, refund);
    }

    /// @notice Spot price in wei per next-token at the current supply.
    function spotPrice() external view returns (uint256) {
        return slope * totalSupply();
    }
}
