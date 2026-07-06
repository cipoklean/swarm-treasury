// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MintableERC20} from "../contracts/MintableERC20.sol";

/// @title MintTokens — mint sUSD to deployer for vault funding
contract MintTokens is Script {
    function run() external {
        uint256 deployerPK = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPK);

        // Deploy mintable token
        MintableERC20 token = new MintableERC20("Swarm USD", "sUSD");
        address deployer = vm.addr(deployerPK);

        // Mint 1M sUSD to deployer
        token.mint(deployer, 1_000_000 ether);
        console.log("MintableERC20:", address(token));
        console.log("Minted 1,000,000 sUSD to", deployer);
        console.log("Balance:", token.balanceOf(deployer));

        vm.stopBroadcast();
    }
}
