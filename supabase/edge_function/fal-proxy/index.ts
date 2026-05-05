// fal-proxy — minimal auth-injecting proxy in front of fal.ai.
//
// The browser uses the fal client configured with `proxyUrl` pointing here.
// The fal client puts the real target endpoint in `x-fal-target-url` and sends
// the body through. We add the `Authorization: Key <FAL_KEY>` header (kept as
// a Supabase secret) and forward.
//
// Only `*.fal.ai`, `*.fal.run`, and `*.fal.media` targets are allowed so this
// proxy can't be turned into a generic open relay.

// Allow bare hosts (`fal.run`) and any subdomain (`*.fal.run`, `queue.fal.run`,
// `rest.fal.ai`, `v3.fal.media`, …). Reject everything else.
const ALLOWED_DOMAINS = ["fal.ai", "fal.run", "fal.media"];

// Response headers we MUST drop before forwarding upstream → browser:
// content-encoding/length/transfer-encoding because Deno fetch auto-decompresses
// and the cached values would mismatch the actual body; connection is hop-by-hop.
const STRIP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

// Wildcard for both Allow-Headers and Expose-Headers — fal client v1.10 sends
// custom request headers (x-fal-queue-priority, x-fal-runner-region, …) that
// we don't want to enumerate. Any header is fine since this proxy only forwards
// to allow-listed fal hosts.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

function isAllowedTarget(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some((d) => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const targetUrl = req.headers.get("x-fal-target-url");
  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: "Missing x-fal-target-url header" }),
      { status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" } },
    );
  }
  if (!isAllowedTarget(targetUrl)) {
    return new Response(
      JSON.stringify({ error: "Target host not allowed" }),
      { status: 403, headers: { ...CORS_HEADERS, "content-type": "application/json" } },
    );
  }

  const falKey = Deno.env.get("FAL_KEY");
  if (!falKey) {
    return new Response(
      JSON.stringify({ error: "FAL_KEY not configured on server" }),
      { status: 500, headers: { ...CORS_HEADERS, "content-type": "application/json" } },
    );
  }

  // Strip hop-by-hop / Supabase-injected headers and inject fal auth.
  const headers = new Headers();
  for (const [k, v] of req.headers.entries()) {
    const lower = k.toLowerCase();
    if (
      lower === "host" ||
      lower === "authorization" ||
      lower === "x-fal-target-url" ||
      lower === "apikey" ||
      lower === "x-client-info" ||
      lower === "content-length"
    ) continue;
    headers.set(k, v);
  }
  headers.set("Authorization", `Key ${falKey}`);
  headers.set("x-fal-client-proxy", "supabase-edge");

  const init: RequestInit = {
    method: req.method,
    headers,
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    // Buffer the body so fetch can compute Content-Length cleanly when needed.
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Upstream fetch failed", detail: String(e) }),
      { status: 502, headers: { ...CORS_HEADERS, "content-type": "application/json" } },
    );
  }

  // Forward upstream response, dropping headers that would confuse the browser
  // after Deno auto-decompressed the body, and enforcing CORS so the browser
  // can read it.
  const respHeaders = new Headers();
  for (const [k, v] of upstream.headers.entries()) {
    if (STRIP_RESPONSE_HEADERS.has(k.toLowerCase())) continue;
    respHeaders.set(k, v);
  }
  for (const [k, v] of Object.entries(CORS_HEADERS)) respHeaders.set(k, v);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
});
