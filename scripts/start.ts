import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { ethers } from "ethers";

function run(cmd: string, args: string[], opts: { detached?: boolean, stdio?: any, env?: NodeJS.ProcessEnv } = {}): ChildProcessWithoutNullStreams {
  const env = {
    ...process.env,
    CHOKIDAR_USEPOLLING: "1",
    CHOKIDAR_INTERVAL: "1000",
    WATCHPACK_POLLING: "true",
    // Some environments respect this to reduce watchers
    FORCE_COLOR: "1",
  } as NodeJS.ProcessEnv;
  const p = spawn(cmd, args, { shell: true, windowsHide: true, env: { ...env, ...(opts.env || {}) }, ...opts });
  p.stdout.on("data", d => process.stdout.write(d));
  p.stderr.on("data", d => process.stderr.write(d));
  return p as ChildProcessWithoutNullStreams;
}

async function waitForRpc(url: string, retries = 100, delayMs = 300) {
  const provider = new ethers.JsonRpcProvider(url);
  for (let i = 0; i < retries; i++) {
    try {
      await provider.getBlockNumber();
      return;
    } catch (_) {}
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error("Hardhat node RPC not responding");
}

async function main() {
  // 1) Start hardhat node
  const node = run(
    "node",
    ["node_modules/hardhat/internal/cli/cli.js", "node", "--hostname", "127.0.0.1", "--port", "8545"],
    { detached: false, env: { CHOKIDAR_USEPOLLING: "1", WATCHPACK_POLLING: "true" } }
  );

  // Wait until stdout indicates server started, or fallback to RPC probing
  const startedMsg = new Promise<void>((resolve) => {
    const onData = (chunk: Buffer) => {
      const s = chunk.toString();
      if (s.includes("Started HTTP") || s.includes("JSON-RPC server at http://127.0.0.1:8545")) {
        node.stdout.off("data", onData);
        resolve();
      }
    };
    node.stdout.on("data", onData);
  });

  // Cleanup on exit
  const cleanup = () => {
    try { node.kill(); } catch {}
  };
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });
  process.on("exit", cleanup);

  // 2) Wait for node to be ready
  await Promise.race([
    startedMsg,
    (async () => { await waitForRpc("http://127.0.0.1:8545"); })(),
  ]);
  // Extra small delay to ensure node fully ready
  await new Promise(r => setTimeout(r, 500));

  // 3) Deploy
  await new Promise<void>((resolve, reject) => {
    const p = run("node", ["node_modules/hardhat/internal/cli/cli.js", "run", "scripts/deploy.ts", "--network", "localhost"], { env: { CHOKIDAR_USEPOLLING: "1", WATCHPACK_POLLING: "true" } });
    p.on("close", code => code === 0 ? resolve() : reject(new Error("deploy failed")));
  });

  // 4) Start UI (keeps running)
  run("node", ["dist/scripts/ui-server.js"]);
}

main().catch(err => { console.error(err); process.exit(1); });


