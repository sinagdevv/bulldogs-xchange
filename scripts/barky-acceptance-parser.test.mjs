import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseVercelResponse, parseVercelResult, sessionIdFrom } from "./barky-acceptance-parser.mjs";
import { buildVercelCurlArgs, persistSessionId } from "./barky-acceptance.mjs";

const uuid = "1417ad0b-af8e-4535-b9cc-dc0b1299982b";
const framed = body => JSON.stringify({
  response: `HTTP/1.1 201 Created\r\nContent-Type: application/json\r\n\r\n${body}`,
  requestId: "req-safe",
});

test("parses the Vercel envelope, HTTP status, and API body", () => {
  const response = parseVercelResponse(framed(JSON.stringify({ success: true, data: { sessionId: uuid } })));
  assert.equal(response.status, 201);
  assert.equal(sessionIdFrom(response), uuid);
  assert.equal(response.requestId, "req-safe");
});

test("retains a valid HTTP 201 response when curl exits 6", () => {
  const response = parseVercelResult({
    status: 6,
    stdout: framed(JSON.stringify({ success: true, data: { sessionId: uuid } })),
    stderr: "curl: (6) Could not resolve host: --silent",
  });
  assert.equal(sessionIdFrom(response), uuid);
  assert.deepEqual(response.transport, { category: "dns-after-response", exitCode: 6 });
});

test("keeps native curl arguments after the required separator without shell flattening", () => {
  const args = buildVercelCurlArgs("dpl_safe", "/api/barky/session", "POST", "barky-accept-session");
  assert.equal(args.includes("--"), true);
  assert.equal(args.includes("X-Request-ID: barky-accept-session"), true);
  assert.equal(args.includes("barky-accept-session"), false);
});

test("rejects malformed outer JSON", () => {
  assert.throws(() => parseVercelResponse("not-json"), /malformed JSON/);
});

test("rejects a missing session UUID", () => {
  const response = parseVercelResponse(framed(JSON.stringify({ success: true, data: {} })));
  assert.throws(() => sessionIdFrom(response), /valid UUID/);
});

test("rejects unexpected response framing", () => {
  assert.throws(() => parseVercelResponse(JSON.stringify({ response: "{}", requestId: "req-safe" })), /HTTP headers/);
});

test("rejects a JSON body without HTTP status framing", () => {
  assert.throws(() => parseVercelResponse(JSON.stringify({
    response: JSON.stringify({ success: true, data: { sessionId: uuid } }), requestId: "req-safe",
  })), /HTTP headers/);
});

test("classifies DNS and proxy failures without response bodies", () => {
  assert.throws(() => parseVercelResult({ status: 6, stdout: "", stderr: "Could not resolve host" }), /transport failed \(dns; exit 6\)/);
  assert.throws(() => parseVercelResult({ status: 5, stdout: "", stderr: "Could not resolve proxy" }), /transport failed \(proxy; exit 5\)/);
});

test("persists the session UUID before chat without exposing it in the filename", () => {
  const base = mkdtempSync(join(tmpdir(), "barky-test-"));
  try {
    const file = persistSessionId(uuid, base);
    assert.equal(readFileSync(file, "utf8"), `${uuid}\n`);
    assert.equal(file.includes(uuid), false);
    if (process.platform !== "win32") assert.equal(statSync(file).mode & 0o777, 0o600);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
