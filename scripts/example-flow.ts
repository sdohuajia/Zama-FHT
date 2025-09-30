import { ethers } from "hardhat";

async function run() {
  const [seller, alice, bob] = await ethers.getSigners();

  const FHESealedBid = await ethers.getContractFactory("FHESealedBid", seller);
  const fhePrecompile = "0x0000000000000000000000000000000000000010";
  const auctionPk = ethers.toUtf8Bytes("demo-auction-pk");

  const c = await FHESealedBid.deploy(fhePrecompile, "Laptop", 60, 60, auctionPk);
  await c.waitForDeployment();

  console.log("Contract:", await c.getAddress());

  // NOTE: In a real stack, we'd call into FHE SDK to encrypt bids with alice/bob keys, then reencrypt to auction key for reveal.
  const dummyCipher = (label: string) => ({ data: ethers.toUtf8Bytes(label) });

  // Bidding phase
  await c.connect(alice).submitEncryptedBid(dummyCipher("alice-enc-bid"), ethers.toUtf8Bytes("alice-pk"));
  await c.connect(bob).submitEncryptedBid(dummyCipher("bob-enc-bid"), ethers.toUtf8Bytes("bob-pk"));

  // Fast-forward is not available without a local chain utility; wait or use hardhat's evm_increaseTime when running via task
  console.log("Bids:", await c.totalBids());
}

run().catch((e) => { console.error(e); process.exitCode = 1; });


