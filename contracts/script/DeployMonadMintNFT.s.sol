// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MonadMintNFT} from "../src/MonadMintNFT.sol";

/// @notice Deploy with:
/// forge script script/DeployMonadMintNFT.s.sol:DeployMonadMintNFT --rpc-url monadTestnet --broadcast
contract DeployMonadMintNFT is Script {
    function run() external returns (MonadMintNFT nft) {
        string memory baseURI = vm.envOr("NFT_BASE_URI", string("ipfs://bafyplaceholder/"));
        uint256 mintPrice = vm.envOr("NFT_MINT_PRICE", uint256(0.01 ether));
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        nft = new MonadMintNFT("Monad Mint Demo", "MMD", baseURI);
        nft.setMintPrice(mintPrice);
        nft.setSaleActive(true);
        vm.stopBroadcast();

        console.log("MonadMintNFT deployed at:", address(nft));
    }
}
