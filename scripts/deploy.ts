import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Placeholder fhEVM precompile address and auction public key
  const fhePrecompile = "0x0000000000000000000000000000000000000010";
  const auctionPk = ethers.toUtf8Bytes("demo-auction-pk");

  const FHESealedBid = await ethers.getContractFactory("FHESealedBid");
  const contract = await FHESealedBid.deploy(
    fhePrecompile,
    "Demo Item",
    300,
    300,
    auctionPk
  );
  await contract.waitForDeployment();

  console.log("FHESealedBid deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


