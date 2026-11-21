// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MonadMintNFT} from "../src/MonadMintNFT.sol";

contract MonadMintNFTTest is Test {
    MonadMintNFT nft;
    address alice = address(0xA11CE);

    function setUp() public {
        nft = new MonadMintNFT("Monad Mint Demo", "MMD", "ipfs://bafyplaceholder/");
    }

    function testMintRequiresActiveSale() public {
        vm.expectRevert(MonadMintNFT.SaleNotActive.selector);
        nft.mint{value: 0.01 ether}(1);
    }

    function testMintAndTokenURI() public {
        vm.prank(nft.owner());
        nft.setSaleActive(true);

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        nft.mint{value: 0.02 ether}(2);

        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.ownerOf(2), alice);
        assertEq(nft.totalMinted(), 2);
        assertEq(nft.tokenURI(2), "ipfs://bafyplaceholder/2.json");
    }

    function testWalletLimitAndPayment() public {
        vm.prank(nft.owner());
        nft.setSaleActive(true);
        vm.prank(nft.owner());
        nft.setMaxPerWallet(2);

        vm.deal(alice, 1 ether);
        vm.startPrank(alice);
        nft.mint{value: 0.02 ether}(2);
        vm.expectRevert(MonadMintNFT.ExceedsWalletLimit.selector);
        nft.mint{value: 0.01 ether}(1);
        vm.expectRevert(MonadMintNFT.IncorrectPayment.selector);
        nft.mint{value: 0 ether}(1);
        vm.stopPrank();
    }

    function testOnlyOwnerCanToggleSale() public {
        vm.prank(alice);
        vm.expectRevert("Ownable: caller is not the owner");
        nft.setSaleActive(true);
    }
}
