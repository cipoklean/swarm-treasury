// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TreasuryVault} from "../contracts/TreasuryVault.sol";
import {MintableERC20} from "../contracts/MintableERC20.sol";
import {MockYieldStrategy} from "../contracts/YieldStrategy.sol";

contract FundVault is Script {
    address constant VAULT    = 0xDE3b01A9f936170e09089CB15A187CaE3442559c;
    address constant TOKEN    = 0xC4A78F258fe5E97DD97C548BEAe237f202C4A37c;
    address constant STRATEGY = 0xAc233f7169E57eA15182F5bC66C2C427a7af6103;

    function run() external {
        uint256 deployerPK = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPK);

        TreasuryVault vault = TreasuryVault(payable(VAULT));

        // 1. Whitelist
        vault.addAssetToWhitelist(TOKEN, 1_000_000 ether, 1000);
        console.log("Whitelisted token");

        // 2. Add strategy
        vault.addStrategy(STRATEGY, TOKEN, 100_000 ether, 500, 30);
        console.log("Added strategy");

        // 3. Approve + deposit
        MintableERC20(TOKEN).approve(VAULT, 100_000 ether);
        vault.deposit(TOKEN, 100_000 ether);
        console.log("Deposited 100,000 sUSD");

        console.log("Vault sUSD balance:", MintableERC20(TOKEN).balanceOf(VAULT));
        vm.stopBroadcast();
    }
}
