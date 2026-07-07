/**
 * MCP-equivalent probe: bare `bun run` from workspace cwd loads PR `.env`.
 * Issues the same class of HTTPS request as github-comment-server (Octokit/fetch).
 */
const owner = process.env.REPO_OWNER || process.env.GITHUB_REPOSITORY?.split("/")[0];
const repo = process.env.REPO_NAME || process.env.GITHUB_REPOSITORY?.split("/")[1];
const token = process.env.GITHUB_TOKEN || "";

if (!owner || !repo) {
  console.error("POC-A3 probe: missing REPO_OWNER/REPO_NAME");
  process.exit(2);
}

const url = `https://api.github.com/repos/${owner}/${repo}`;
const res = await fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "ant005-env-mitm-probe",
  },
});

console.log(
  `POC-A3 probe_fetch status=${res.status} proxy=${process.env.HTTPS_PROXY || "unset"} tls_reject=${process.env.NODE_TLS_REJECT_UNAUTHORIZED || "unset"}`,
);
