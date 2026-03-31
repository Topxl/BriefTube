import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This route tests if cookies are received for different HTTP methods
// Visit /debug-methods while logged in to see results

export async function GET(_req: NextRequest) {
  const html = `<!DOCTYPE html>
<html><head><title>Debug Methods</title></head>
<body style="background:#111;color:#eee;font-family:monospace;padding:20px">
<h2>API Method Test</h2>
<pre id="results">Testing...</pre>
<script>
async function test() {
  const el = document.getElementById('results');
  let out = '';
  for (const method of ['GET', 'POST', 'DELETE', 'PATCH']) {
    try {
      const res = await fetch('/api/debug/auth', { method });
      const data = await res.json();
      out += method + ' → HTTP ' + res.status + ' → userId=' + (data.userId || 'null') + ' cookies=' + (data.cookies ? data.cookies.substring(0, 60) + '...' : 'none') + '\\n';
    } catch(e) {
      out += method + ' → ERROR: ' + e.message + '\\n';
    }
  }
  el.textContent = out;
}
test();
</script>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
