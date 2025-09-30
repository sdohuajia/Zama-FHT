import { expect } from "chai";
import { ethers } from "hardhat";
import { FHESealedBid__factory } from "../typechain-types";

describe("FHESealedBid", function () {
  async function deployFixture() {
    const [seller, alice, bob, carol] = await ethers.getSigners();

    const MockFHE = await ethers.getContractFactory("MockFHE");
    const fhe = await MockFHE.deploy();
    await fhe.waitForDeployment();

    const FHESealedBid = (await ethers.getContractFactory("FHESealedBid")) as unknown as FHESealedBid__factory;
    const biddingSeconds = 60;
    const revealSeconds = 60;
    const auctionPk = ethers.toUtf8Bytes("auction-pk");
    const c = await FHESealedBid.deploy(
      await fhe.getAddress(),
      "Laptop",
      biddingSeconds,
      revealSeconds,
      auctionPk
    );
    await c.waitForDeployment();

    return { seller, alice, bob, carol, fhe, c, biddingSeconds, revealSeconds };
  }

  async function increaseTime(seconds: number) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  it("accepts encrypted bids in bidding phase", async () => {
    const { c, alice } = await deployFixture();
    const enc = { data: ethers.toUtf8Bytes("alice-10") };
    await expect(c.connect(alice).submitEncryptedBid(enc, ethers.toUtf8Bytes("alice-pk")))
      .to.emit(c, "BidSubmitted");
    expect(await c.totalBids()).to.equal(1);
  });

  it("rejects bidding after deadline", async () => {
    const { c, alice, biddingSeconds } = await deployFixture();
    await increaseTime(biddingSeconds + 1);
    const enc = { data: ethers.toUtf8Bytes("alice-10") };
    await expect(c.connect(alice).submitEncryptedBid(enc, ethers.toUtf8Bytes("alice-pk")))
      .to.be.revertedWith("bad phase");
  });

  it("selects the highest bid via encrypted compare on reveal", async () => {
    const { c, alice, bob, biddingSeconds } = await deployFixture();
    const enc = (s: string) => ({ data: ethers.toUtf8Bytes(s) });
    await c.connect(alice).submitEncryptedBid(enc("alice-10"), ethers.toUtf8Bytes("alice-pk"));
    await c.connect(bob).submitEncryptedBid(enc("bob-20"), ethers.toUtf8Bytes("bob-pk"));

    await increaseTime(biddingSeconds + 1);

    // With MockFHE, we pretend the re-encrypted ciphertext embeds numbers in the label ordering
    await expect(c.connect(alice).reveal(0, enc("num-10"))).to.emit(c, "BidRevealed");
    await expect(c.connect(bob).reveal(1, enc("num-20"))).to.emit(c, "WinnerUpdated");
  });

  it("finalizes after reveal period and exposes encrypted price", async () => {
    const { c, alice, bob, seller, biddingSeconds, revealSeconds } = await deployFixture();
    const enc = (n: number) => ({ data: ethers.AbiCoder.defaultAbiCoder().encode(["uint64"], [n]) });
    await c.connect(alice).submitEncryptedBid(enc(10), ethers.toUtf8Bytes("alice-pk"));
    await c.connect(bob).submitEncryptedBid(enc(20), ethers.toUtf8Bytes("bob-pk"));

    await increaseTime(biddingSeconds + 1);
    await c.connect(alice).reveal(0, enc(10));
    await c.connect(bob).reveal(1, enc(20));

    await increaseTime(revealSeconds + 1);
    const tx = await c.connect(seller).finalize();
    const rcpt = await tx.wait();
    const ev = rcpt!.logs.find((l: any) => l.fragment?.name === "Finalized");
    expect(ev).to.exist;
  });
});


