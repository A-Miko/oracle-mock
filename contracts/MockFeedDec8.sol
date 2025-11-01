// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Minimal mock with 8 decimals and a writable latestAnswer.
// Matches the essential AggregatorV3Interface surface needed for local testing.
contract MockFeedDec8 {
    int256 public latestAnswer;

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function setLatestAnswer(int256 answer) external {
        latestAnswer = answer;
    }

    // Optional alias to mirror some reader usage.
    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (0, latestAnswer, block.timestamp, block.timestamp, 0);
    }
}
