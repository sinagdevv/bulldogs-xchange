const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseVercelResponse(raw) {
  let envelope;
  try { envelope = JSON.parse(raw); }
  catch { throw new Error("Vercel CLI returned malformed JSON."); }
  if (!envelope || typeof envelope.response !== "string" || typeof envelope.requestId !== "string") {
    throw new Error("Unexpected Vercel CLI response envelope.");
  }
  const split = envelope.response.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})[^\r\n]*\r?\n[\s\S]*?\r?\n\r?\n([\s\S]*)$/);
  if (!split) throw new Error("Vercel response did not contain HTTP headers and a body.");
  let body;
  try { body = JSON.parse(split[2]); }
  catch { throw new Error("API returned malformed JSON."); }
  return { status: Number(split[1]), body, requestId: envelope.requestId };
}

export function parseVercelResult(result) {
  let response;
  try { response = parseVercelResponse(result.stdout); }
  catch (error) {
    if (result.status !== 0 || result.error) {
      const category = /use --yes|confirm/i.test(result.stderr ?? "")
        ? "confirmation"
        : /authenticat|credentials|log in|login/i.test(result.stderr ?? "") ? "authentication"
          : result.status === 6 || /resolve host|dns/i.test(result.stderr ?? "") ? "dns"
            : /proxy/i.test(result.stderr ?? "") ? "proxy" : "process";
      throw new Error(`Vercel transport failed (${category}; exit ${result.error?.code ?? result.status ?? "unknown"}); no valid HTTP response was captured.`);
    }
    throw error;
  }
  return {
    ...response,
    transport: {
      category: result.status === 0 ? "ok" : result.status === 6 ? "dns-after-response" : "nonzero-after-response",
      exitCode: result.status,
    },
  };
}

export function sessionIdFrom(response) {
  const value = response?.body?.data?.sessionId;
  if (response?.status !== 201 || response?.body?.success !== true || typeof value !== "string" || !UUID.test(value)) {
    throw new Error("Session response did not contain a valid UUID.");
  }
  return value;
}

export function assertCollectionSafety(reply) {
  if (/(program uniform|vest|blazer|psychology|traditional college|senior high|\bSHS\b)/i.test(reply)
      && !/(not (?:yet )?reservable|preview only|xchange counter.{0,40}inquir)/i.test(reply)) {
    throw new Error("Collection-only merchandise was presented without a non-reservable warning.");
  }
}
