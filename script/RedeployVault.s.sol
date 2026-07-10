// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TreasuryVault} from "../contracts/TreasuryVault.sol";

contract RedeployVault is Script {
    function run() external {
        uint256 deployerPK = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 governorPK = vm.envUint("GOVERNOR_PRIVATE_KEY");
        uint256 yieldPK = vm.envUint("YIELD_SCOUT_PRIVATE_KEY");
        uint256 riskPK  = vm.envUint("RISK_GUARD_PRIVATE_KEY");
        uint256 execPK  = vm.envUint("EXECUTOR_PRIVATE_KEY");

        vm.startBroadcast(deployerPK);

        TreasuryVault vault = new TreasuryVault();
        vault.initialize(vm.addr(governorPK), vm.addr(governorPK),
            0x9b29Fe91ABE65846F0EeFf3989b9C8a496E2260B,
            0xA9e5FF4F6284c22dD98bac50bEd86A2E3ED5d43D);

        vault.grantRole(keccak256("YIELD_SCOUT_ROLE"), vm.addr(yieldPK));
        vault.grantRole(keccak256("RISK_GUARD_ROLE"),  vm.addr(riskPK));
        vault.grantRole(keccak256("EXECUTOR_ROLE"),    vm.addr(execPK));
        // Allow the deployed Governor contract to pause/withdraw via this vault
        vault.grantRole(keccak256("GOVERNOR_ROLE"), 0x088e7FA7271858f5Fb3E029818AC3e5A174aEEcd);

        vault.addAssetToWhitelist(0xC4A78F258fe5E97DD97C548BEAe237f202C4A37c, 1_000_000 ether, 1000);

        vault.addStrategy(0xAc233f7169E57eA15182F5bC66C2C427a7af6103, 0xC4A78F258fe5E97DD97C548BEAe237f202C4A37c, 100_000 ether, 500, 30);
        vault.addStrategy(0x0e4D0E4ff89FAD14b56e8d433140C0c1F0E5B57e, 0xC4A78F258fe5E97DD97C548BEAe237f202C4A37c, 100_000 ether, 500, 30);

        vm.stopBroadcast();
        console.log("Vault:", address(vault));
    }
}
