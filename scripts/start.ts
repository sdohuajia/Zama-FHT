import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { ethers } from "ethers";

function run(cmd: string, args: string[], opts: { detached?: boolean, stdio?: any } = {}): ChildProcessWithoutNullStreams {
  const p = spawn(cmd, args, { shell: true, windowsHide: true, ...opts });
  p.stdout.on("data", d => process.stdout.write(d));
  p.stderr.on("data", d => process.stderr.write(d));
  return p as ChildProcessWithoutNullStreams;
}

async function waitForRpc(url: string, retries = 50, delayMs = 200) {
  for (let i = 0; i < retries; i++) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber();
      return;
    } catch (_) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error("Hardhat node RPC not responding");
}

async function main() {
  // 1) Start hardhat node
  const node = run("npx", ["hardhat", "node"], { detached: false });

  // Cleanup on exit
  const cleanup = () => {
    try { node.kill(); } catch {}
  };
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });
  process.on("exit", cleanup);

  // 2) Wait for RPC
  await waitForRpc("http://127.0.0.1:8545");

  // 3) Deploy
  await new Promise<void>((resolve, reject) => {
    const p = run("npx", ["hardhat", "run", "scripts/deploy.ts", "--network", "localhost"]);
    p.on("close", code => code === 0 ? resolve() : reject(new Error("deploy failed")));
  });

  // 4) Start UI (keeps running)
  run("npx", ["ts-node", "scripts/ui-server.ts"]);
}

main().catch(err => { console.error(err); process.exit(1); });


