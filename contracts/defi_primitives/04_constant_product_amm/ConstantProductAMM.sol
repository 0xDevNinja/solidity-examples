// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title ConstantProductAMM
/// @notice Educational Uniswap V2 style x*y=k AMM. LP shares are tracked
///         internally (no separate LP token contract).
contract ConstantProductAMM is ReentrancyGuard {
    ERC20 public immutable token0;
    ERC20 public immutable token1;

    uint256 public reserve0;
    uint256 public reserve1;

    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;

    /// @dev 0.30% fee, applied on the input side (Uniswap V2 style).
    uint256 public constant FEE_NUMERATOR = 997;
    uint256 public constant FEE_DENOMINATOR = 1000;

    event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 amount0, uint256 amount1, uint256 shares);
    event Swapped(address indexed trader, address tokenIn, uint256 amountIn, uint256 amountOut);

    constructor(address t0, address t1) {
        require(t0 != address(0) && t1 != address(0), "zero token");
        require(t0 != t1, "same token");
        token0 = ERC20(t0);
        token1 = ERC20(t1);
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function addLiquidity(uint256 amount0, uint256 amount1) external nonReentrant returns (uint256 shares) {
        require(amount0 > 0 && amount1 > 0, "zero amount");
        require(token0.transferFrom(msg.sender, address(this), amount0), "t0 in");
        require(token1.transferFrom(msg.sender, address(this), amount1), "t1 in");

        if (totalShares == 0) {
            shares = _sqrt(amount0 * amount1);
        } else {
            shares = _min((amount0 * totalShares) / reserve0, (amount1 * totalShares) / reserve1);
        }
        require(shares > 0, "zero shares");

        sharesOf[msg.sender] += shares;
        totalShares += shares;

        reserve0 += amount0;
        reserve1 += amount1;

        emit LiquidityAdded(msg.sender, amount0, amount1, shares);
    }

    function removeLiquidity(uint256 shares) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        require(shares > 0 && shares <= sharesOf[msg.sender], "bad shares");

        amount0 = (shares * reserve0) / totalShares;
        amount1 = (shares * reserve1) / totalShares;
        require(amount0 > 0 && amount1 > 0, "zero out");

        sharesOf[msg.sender] -= shares;
        totalShares -= shares;
        reserve0 -= amount0;
        reserve1 -= amount1;

        require(token0.transfer(msg.sender, amount0), "t0 out");
        require(token1.transfer(msg.sender, amount1), "t1 out");

        emit LiquidityRemoved(msg.sender, amount0, amount1, shares);
    }

    function swap(address tokenIn, uint256 amountIn) external nonReentrant returns (uint256 amountOut) {
        require(amountIn > 0, "zero in");
        require(tokenIn == address(token0) || tokenIn == address(token1), "bad token");

        bool zeroForOne = tokenIn == address(token0);
        (ERC20 inT, ERC20 outT, uint256 reserveIn, uint256 reserveOut) = zeroForOne
            ? (token0, token1, reserve0, reserve1)
            : (token1, token0, reserve1, reserve0);

        require(reserveIn > 0 && reserveOut > 0, "no liquidity");
        require(inT.transferFrom(msg.sender, address(this), amountIn), "in xfer");

        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * FEE_DENOMINATOR + amountInWithFee;
        amountOut = numerator / denominator;
        require(amountOut > 0 && amountOut < reserveOut, "bad out");

        if (zeroForOne) {
            reserve0 += amountIn;
            reserve1 -= amountOut;
        } else {
            reserve1 += amountIn;
            reserve0 -= amountOut;
        }
        require(outT.transfer(msg.sender, amountOut), "out xfer");

        emit Swapped(msg.sender, tokenIn, amountIn, amountOut);
    }
}
