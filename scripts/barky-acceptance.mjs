import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { assertCollectionSafety, parseVercelResult, sessionIdFrom } from "./barky-acceptance-parser.mjs";

const APPROVED_PROJECT = "prj_pv3TMS6MXH4G58DVvQ8eFpgKuyMf";
const APPROVED_SCOPE = "johnraycacananta-4646s-projects";
const QUESTION = "What Bulldogs Xchange merchandise is available?";
function runNpx(args) {
  const npxCli = process.env.npm_execpath?.endsWith(".js")
    ? process.env.npm_execpath
    : join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
  if (!existsSync(npxCli)) throw new Error("Local npm executable was not found.");
  return spawnSync(process.execPath, [npxCli, ...args], { encoding: "utf8", shell: false });
}

export function buildVercelCurlArgs(deployment, path, method, correlationId, data = undefined) {
  const args = ["--yes", "vercel@64.0.2", "curl", path, "--deployment", deployment,
    "--scope", APPROVED_SCOPE, "--yes", "--trace", "--json", "--", "--silent", "--show-error",
    "--include", "--request", method, "--header", `X-Request-ID: ${correlationId}`];
  if (data) args.push("--header", "Content-Type: application/json", "--data", JSON.stringify(data));
  return args;
}

function vercelCurl(deployment, path, method, correlationId, data = undefined) {
  return parseVercelResult(runNpx(buildVercelCurlArgs(deployment, path, method, correlationId, data)));
}

function sanitizedChatLogs(deployment) {
  const result = runNpx(["--yes", "vercel@64.0.2", "logs", "runtime", "--deployment", deployment,
    "--since", "10m", "--query", "barky-accept-chat", "--limit", "20", "--scope", APPROVED_SCOPE, "--json"]);
  if (result.status !== 0) throw new Error("Sanitized Vercel log inspection failed.");
  return result.stdout.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

export function persistSessionId(sessionId, baseDirectory = tmpdir()) {
  const directory = mkdtempSync(join(baseDirectory, "barky-acceptance-"));
  chmodSync(directory, 0o700);
  const file = join(directory, "session-id");
  writeFileSync(file, `${sessionId}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  return file;
}

export function main(argv = process.argv) {
  const deployment = argv[argv.indexOf("--deployment") + 1];
  if (!argv.includes("--execute") || !/^dpl_[A-Za-z0-9]+$/.test(deployment ?? "")) {
    throw new Error("Usage: node scripts/barky-acceptance.mjs --execute --deployment dpl_...");
  }
  const session = vercelCurl(deployment, "/api/barky/session", "POST", "barky-accept-session");
  const sessionId = sessionIdFrom(session);
  const sessionFile = persistSessionId(sessionId);
  const chat = vercelCurl(deployment, "/api/barky/chat", "POST", "barky-accept-chat", { sessionId, message: QUESTION });
  if (chat.status !== 200 || chat.body?.success !== true) throw new Error(`Chat API failed with HTTP ${chat.status}; session retained at ${sessionFile}.`);
  const reply = chat.body?.data?.reply;
  if (typeof reply !== "string" || !reply.trim()) throw new Error(`Chat response was empty; session retained at ${sessionFile}.`);
  assertCollectionSafety(reply);
  const history = vercelCurl(deployment, `/api/barky/history?sessionId=${encodeURIComponent(sessionId)}`, "GET", "barky-accept-history");
  if (history.status !== 200 || history.body?.success !== true || !Array.isArray(history.body.data)) throw new Error(`History API failed with HTTP ${history.status}; session retained at ${sessionFile}.`);
  const persisted = history.body.data;
  if (persisted.length !== 2 || persisted[0]?.role !== "user" || persisted[0]?.content !== QUESTION
      || persisted[1]?.role !== "assistant" || persisted[1]?.content !== reply) {
    throw new Error(`Persisted history does not exactly match the accepted conversation; session retained at ${sessionFile}.`);
  }
  const logs = sanitizedChatLogs(deployment);
  unlinkSync(sessionFile);
  console.log(JSON.stringify({
    project: APPROVED_PROJECT,
    deployment,
    sessionCaptured: true,
    statuses: { session: session.status, chat: chat.status, history: history.status },
    transports: { session: session.transport, chat: chat.transport, history: history.transport },
    aiAvailable: chat.body.data.aiAvailable,
    reply,
    requestIds: { session: session.requestId, chat: chat.requestId, history: history.requestId },
    logs,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
