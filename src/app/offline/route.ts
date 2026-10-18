import { BRAND } from "@/config/brand";

/**
 * What the dashboard or till shows when a page can't load for want of a
 * connection (the service worker keeps a copy, see app/sw.js). One
 * self-contained page: no scripts or stylesheets that might be out of reach.
 */
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Offline · ${BRAND.name}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box;
    font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #f5f5f1; color: #1f2a24; }
  main { max-width: 360px; text-align: center; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  p { margin: 0 0 20px; color: #4d5952; }
  button { min-height: 48px; padding: 0 24px; border: 0; border-radius: 12px; background: #24573f; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  @media (prefers-color-scheme: dark) { body { background: #16181a; color: #fff; } p { color: #c3c7c2; } button { background: #5fbf84; color: #0e2418; } }
</style>
</head>
<body>
<main>
  <h1>You're offline</h1>
  <p>This page needs a connection. On the till, stamps you add on a card that's already open are kept and sent as soon as you're back.</p>
  <button type="button" onclick="location.reload()">Try again</button>
</main>
</body>
</html>`;

export function GET() {
  return new Response(PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
