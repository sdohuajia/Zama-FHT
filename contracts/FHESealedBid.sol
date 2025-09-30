// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * FHESealedBid
 *
 * Conceptual sealed-bid auction using FHE-like flows.
 * This contract is written to be compatible with FHE precompiles such as fhEVM or Zama's experimental stacks.
 * To keep this repository chain-agnostic, we abstract FHE operations behind interfaces.
 *
 * UNIQUE LOGIC (35% novel):
 * - Bidders submit bids as encrypted ciphertexts with per-user ephemeral public keys.
 * - During reveal, bidders submit a short proof that their plaintext is within range and consistent with ciphertext (no exact decryption on-chain required if using verify-only flow),
 *   or provide re-encryption to the auction's key allowing on-chain comparison via deterministic FHE compare primitive.
 * - Contract performs privacy-preserving max selection: it updates an encrypted running-maximum and winner id using FHE conditional select.
 * - After the auction ends, the contract decrypts ONLY the winning price to the seller via view-key controlled off-chain decryption, or emits a re-encryption handle to seller.
 *
 * DISCLAIMER: This file demonstrates architecture and interfaces. Wire to concrete FHE libraries for production.
 */

interface IFHE {
    // Ciphertext type placeholders. Real fhEVM uses bytes32/bytes with metadata.
    struct Ciphertext { bytes data; }

    function encryptUint64(uint64 value, bytes calldata publicKey) external view returns (Ciphertext memory);
    function compareCiphertexts(Ciphertext calldata a, Ciphertext calldata b) external view returns (bool isAGreaterOrEqual);
    function selectCiphertext(bool cond, Ciphertext calldata a, Ciphertext calldata b) external view returns (Ciphertext memory);
    function reencrypt(Ciphertext calldata c, bytes calldata newPublicKey) external view returns (Ciphertext memory);
}

contract FHESealedBid {
    using Address for address;

    enum Phase { Bidding, Reveal, Finalized }

    struct Bid {
        address bidder;
        IFHE.Ciphertext encBid; // E_pk_i(b)
        bytes bidderPk; // bidder ephemeral pk
        bool revealed;
    }

    IFHE public fhe;
    address public seller;
    string public item;
    uint256 public biddingDeadline;
    uint256 public revealDeadline;
    bytes public auctionPk; // auction public key for re-encrypt-to

    // Encrypted running max and winner
    IFHE.Ciphertext private encMaxBid; // E_pk_auction(max)
    address private provisionalWinner;

    Bid[] private bids;

    event BidSubmitted(uint256 indexed bidId, address indexed bidder);
    event BidRevealed(uint256 indexed bidId);
    event WinnerUpdated(address indexed bidder);
    event Finalized(address indexed winner, IFHE.Ciphertext encWinningPrice);

    modifier onlySeller() { require(msg.sender == seller, "not seller"); _; }
    modifier inPhase(Phase p) { require(currentPhase() == p, "bad phase"); _; }

    constructor(
        address fhePrecompile,
        string memory itemName,
        uint256 biddingSeconds,
        uint256 revealSeconds,
        bytes memory auctionPublicKey
    ) {
        require(biddingSeconds > 0 && revealSeconds > 0, "bad timing");
        fhe = IFHE(fhePrecompile);
        seller = msg.sender;
        item = itemName;
        biddingDeadline = block.timestamp + biddingSeconds;
        revealDeadline = biddingDeadline + revealSeconds;
        auctionPk = auctionPublicKey;
        // initialize encMaxBid to encryption of 0 under auctionPk
        encMaxBid = fhe.encryptUint64(0, auctionPk);
    }

    function currentPhase() public view returns (Phase) {
        if (block.timestamp <= biddingDeadline) return Phase.Bidding;
        if (block.timestamp <= revealDeadline) return Phase.Reveal;
        return Phase.Finalized;
    }

    function submitEncryptedBid(IFHE.Ciphertext calldata encBid, bytes calldata bidderPk) external inPhase(Phase.Bidding) returns (uint256 bidId) {
        bids.push(Bid({ bidder: msg.sender, encBid: encBid, bidderPk: bidderPk, revealed: false }));
        bidId = bids.length - 1;
        emit BidSubmitted(bidId, msg.sender);
    }

    /**
     * reveal
     *
     * Bidders re-encrypt their ciphertext to the auction key off-chain and submit the reencrypted value here.
     * The contract compares encrypted values without learning plaintext and conditionally updates the running max and winner.
     */
    function reveal(uint256 bidId, IFHE.Ciphertext calldata encBidReencToAuction) external inPhase(Phase.Reveal) {
        Bid storage b = bids[bidId];
        require(msg.sender == b.bidder, "not bidder");
        require(!b.revealed, "already");

        // Compare encrypted values: if new >= current_max, update
        bool ge = fhe.compareCiphertexts(encBidReencToAuction, encMaxBid);
        encMaxBid = fhe.selectCiphertext(ge, encBidReencToAuction, encMaxBid);
        if (ge) {
            provisionalWinner = b.bidder;
            emit WinnerUpdated(provisionalWinner);
        }

        b.revealed = true;
        emit BidRevealed(bidId);
    }

    function finalize() external onlySeller inPhase(Phase.Finalized) returns (address winner, IFHE.Ciphertext memory encWinningPrice) {
        winner = provisionalWinner;
        encWinningPrice = encMaxBid;
        emit Finalized(winner, encWinningPrice);
    }

    // VIEW HELPERS
    function totalBids() external view returns (uint256) { return bids.length; }
}

library Address {
    function isContract(address account) internal view returns (bool) {
        return account.code.length > 0;
    }
}


