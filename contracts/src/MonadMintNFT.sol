// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title MonadMintNFT
/// @notice Simple paid ERC-721 mint for a Monad testnet demo. Metadata is served
///         from a configurable base URI (IPFS/HTTP) as `<base><tokenId>.json`.
contract MonadMintNFT is ERC721, Ownable {
    uint256 public constant MAX_SUPPLY = 10_000;

    uint256 public mintPrice = 0.01 ether;
    uint256 public maxPerWallet = 5;
    bool public saleActive = false;

    uint256 public totalMinted;
    string private baseTokenURI;

    event Minted(address indexed to, uint256 indexed firstTokenId, uint256 quantity);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event MaxPerWalletUpdated(uint256 oldLimit, uint256 newLimit);
    event SaleToggled(bool active);
    event BaseURIUpdated(string baseURI);

    error SaleNotActive();
    error ZeroQuantity();
    error ExceedsMaxSupply();
    error ExceedsWalletLimit();
    error IncorrectPayment();
    error EmptyBaseURI();

    constructor(string memory name_, string memory symbol_, string memory baseTokenURI_)
        ERC721(name_, symbol_)
        Ownable(msg.sender)
    {
        if (bytes(baseTokenURI_).length == 0) revert EmptyBaseURI();
        baseTokenURI = baseTokenURI_;
    }

    /// @notice Mint `quantity` tokens. Price is fixed per token, paid in native MON.
    /// @return firstTokenId The first token id minted in this call.
    function mint(uint256 quantity) external payable returns (uint256 firstTokenId) {
        if (!saleActive) revert SaleNotActive();
        if (quantity == 0) revert ZeroQuantity();
        if (totalMinted + quantity > MAX_SUPPLY) revert ExceedsMaxSupply();
        if (balanceOf(msg.sender) + quantity > maxPerWallet) revert ExceedsWalletLimit();
        if (msg.value != mintPrice * quantity) revert IncorrectPayment();

        firstTokenId = totalMinted + 1;
        uint256 nextTokenId = firstTokenId;
        for (uint256 i = 0; i < quantity; ++i) {
            _safeMint(msg.sender, nextTokenId++);
        }
        totalMinted = nextTokenId - 1;

        emit Minted(msg.sender, firstTokenId, quantity);
    }

    function setMintPrice(uint256 newPrice) external onlyOwner {
        emit MintPriceUpdated(mintPrice, newPrice);
        mintPrice = newPrice;
    }

    function setMaxPerWallet(uint256 newLimit) external onlyOwner {
        if (newLimit == 0) revert ZeroQuantity();
        emit MaxPerWalletUpdated(maxPerWallet, newLimit);
        maxPerWallet = newLimit;
    }

    function setSaleActive(bool active) external onlyOwner {
        saleActive = active;
        emit SaleToggled(active);
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        if (bytes(newBaseURI).length == 0) revert EmptyBaseURI();
        baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /// @notice Withdraw collected MON to the owner.
    function withdraw() external onlyOwner {
        (bool success,) = payable(owner()).call{value: address(this).balance}("");
        require(success, "MON transfer failed");
    }

    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalMinted;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(baseTokenURI, Strings.toString(tokenId), ".json");
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }
}
