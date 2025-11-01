// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockFeedDec18 {
    int256 public latestAnswer;

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function setLatestAnswer(int256 answer) external {
        latestAnswer = answer;
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (0, latestAnswer, block.timestamp, block.timestamp, 0);
    }
}
