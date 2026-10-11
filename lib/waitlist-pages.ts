export const TOKEN_RE = /^[a-f0-9]{64}$/;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
}

export function privatePage(title: string, content: string, status = 200): Response {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} | Prompt Launchpad</title></head><body><main><h1>${escapeHtml(title)}</h1>${content}<p><a href="/">Prompt Launchpad home</a> · <a href="/privacy">Privacy</a></p></main></body></html>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      // no-referrer makes basic browser form POSTs send Origin: null, which
      // the same-origin guard correctly rejects. strict-origin still strips
      // the token-bearing path/query while preserving a usable POST Origin.
      "Referrer-Policy": "strict-origin",
      "Content-Security-Policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export function confirmationForm(path: "/verify" | "/unsubscribe", token: string, label: string): string {
  return `<form method="post" action="${path}"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">${escapeHtml(label)}</button></form>`;
}

/** Bound and validate the form before any gateway call. GET never uses this. */
export async function postedToken(request: Request): Promise<string | null> {
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return null;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) return null;
  if (Number(request.headers.get("content-length")) > 4096 || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const params = new URLSearchParams(new TextDecoder().decode(bytes));
  const tokens = params.getAll("token");
  return tokens.length === 1 && TOKEN_RE.test(tokens[0]) ? tokens[0] : null;
}
