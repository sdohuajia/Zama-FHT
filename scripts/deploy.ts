import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Deploy MockFHE and use its address for constructor to avoid revert
  const MockFHE = await ethers.getContractFactory("MockFHE");
  const mock = await MockFHE.deploy();
  await mock.waitForDeployment();
  const fhePrecompile = await mock.getAddress();
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


