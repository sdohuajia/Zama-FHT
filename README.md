# FHE Sealed-Bid Auction (Architecture + Prototype)

This repo demonstrates a minimal yet meaningful architecture using FHE concepts in a Solidity contract. It is chain-agnostic and abstracts FHE primitives behind an interface so you can plug in fhEVM or other providers.

## Features
- Sealed bids submitted as encrypted ciphertexts with per-bidder ephemeral keys
- Reveal via re-encryption to auction key and privacy-preserving max selection on-chain
- Only the encrypted winning price is exposed on finalize; seller can decrypt off-chain

## Stack
- Hardhat + TypeScript
- Solidity 0.8.26

## Install
```bash
npm install
```

## Build
```bash
npm run build
```

## Local Deploy (example)
```bash
npx hardhat node &
npm run deploy
```

## Contract Overview
- `contracts/FHESealedBid.sol`: Contains interface `IFHE` and the `FHESealedBid` logic.
- Replace the `IFHE` interface with your concrete FHE precompile or library. Implement:
  - `encryptUint64(uint64, pk)`
  - `compareCiphertexts(a,b)` returning whether a ≥ b
  - `selectCiphertext(cond, a, b)` returning cond ? a : b
  - `reencrypt(c, newPk)` re-encrypting to auction key during reveal

## Notes on Meaningful FHE Usage
- Bids remain encrypted end-to-end; contract updates an encrypted running-maximum without decryption
- Winner identity is public, but price remains encrypted until off-chain decryption
- Works with verification-only flows if your FHE stack supports range proofs instead of on-chain compare

## Example Script
See `scripts/example-flow.ts` for a minimal walkthrough (uses dummy ciphertexts; swap with your FHE SDK calls).

## Security and Production
- Add commit-reveal or deposit-slashing to deter griefing
- Validate ciphertext formats and domain separation
- Consider replay protection and per-auction keys
