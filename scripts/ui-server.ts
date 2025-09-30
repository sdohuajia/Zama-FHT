import http from "http";
import fs from "fs";
import path from "path";

const port = 5173;
const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FHE Sealed-Bid Auction</title>
  <style>
    body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:40px;line-height:1.5;color:#111}
    .card{max-width:720px;margin:auto;border:1px solid #eee;border-radius:12px;padding:24px;box-shadow:0 8px 24px rgba(0,0,0,.06)}
    .row{display:flex;gap:12px;align-items:center;margin:8px 0}
    input,button{padding:10px 12px;border:1px solid #ddd;border-radius:8px}
    button{background:#111;color:#fff;cursor:pointer}
    button:disabled{opacity:.5;cursor:not-allowed}
    h1{font-size:24px;margin:0 0 12px}
    small{color:#666}
    .list{margin-top:16px}
    code{background:#f6f6f6;padding:2px 6px;border-radius:6px}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/ethers@6.12.1/dist/ethers.umd.min.js"></script>
</head>
<body>
  <div class="card">
    <h1>FHE Sealed-Bid Auction</h1>
    <div class="row"><label>Contract <input id="addr" placeholder="0x..." style="width:420px"></label><button id="connect">Connect Wallet</button></div>
    <div class="row"><label>Bid (uint64) <input id="bid" type="number" min="0" step="1"></label><button id="submit">Submit Encrypted Bid</button></div>
    <div class="row"><label>Reveal value <input id="reveal" type="number" min="0" step="1"></label><button id="revealBtn">Reveal</button></div>
    <div class="row"><button id="finalize">Finalize (seller)</button></div>
    <div class="list" id="log"></div>
    <small>Note: This demo uses a mock encryption. Replace with your FHE SDK.</small>
  </div>
  <script>
    const abi = [
      "function submitEncryptedBid((bytes) encBid, bytes bidderPk) returns (uint256)",
      "function reveal(uint256 bidId, (bytes) encBidReencToAuction)",
      "function finalize() returns (address,(bytes))",
      "function totalBids() view returns (uint256)"
    ];
    const log = (m)=>{ const d=document.getElementById('log'); const p=document.createElement('div'); p.textContent=m; d.prepend(p); };
    let provider, signer, contract;
    async function init(){
      if(window.ethereum){ provider = new ethers.BrowserProvider(window.ethereum); }
    }
    document.getElementById('connect').onclick = async ()=>{
      await provider.send('eth_requestAccounts', []);
      signer = await provider.getSigner();
      const addr = document.getElementById('addr').value.trim();
      contract = new ethers.Contract(addr, abi, signer);
      log('Connected ' + await signer.getAddress());
    };
    document.getElementById('submit').onclick = async ()=>{
      const v = Number(document.getElementById('bid').value||0);
      const enc = ethers.AbiCoder.defaultAbiCoder().encode(["uint64"],[v]);
      const tx = await contract.submitEncryptedBid({data: enc}, ethers.toUtf8Bytes('ui-pk'));
      const rcpt = await tx.wait();
      log('Bid submitted. total=' + (await contract.totalBids()));
    };
    document.getElementById('revealBtn').onclick = async ()=>{
      const v = Number(document.getElementById('reveal').value||0);
      const enc = ethers.AbiCoder.defaultAbiCoder().encode(["uint64"],[v]);
      const bidId = Number(prompt('Bid ID to reveal?'));
      const tx = await contract.reveal(bidId, {data: enc});
      await tx.wait();
      log('Revealed bid #' + bidId);
    };
    document.getElementById('finalize').onclick = async ()=>{
      const tx = await contract.finalize();
      const rcpt = await tx.wait();
      const ev = rcpt.logs.find(l=> l.fragment && l.fragment.name==='Finalized');
      log('Finalized. Winner: ' + ev.args[0] + ' EncryptedPrice bytes=' + ev.args[1].data.length);
    };
    init();
  </script>
</body>
</html>`;

http.createServer((_, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}).listen(port, () => console.log(`UI running on http://localhost:${port}`));


