import type { NextConfig } from "next";

/**
 * Sent with every response. Pages may only be framed by our own (the
 * editor's phone preview, the home page demos), never by another site, so
 * the dashboard can't be overlaid for clickjacking. The camera is for the
 * till's card scanner on our own pages only.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\" \"https://api.razorpay.com\")" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // Stamped into the service worker (app/sw.js), so each deploy is a new version on tills and dashboards.
  env: { APP_BUILD: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now()) },
  // Cached functions ("use cache"), static shells streamed ahead of request-time content, and
  // the groundwork for instant navigations (docs: guides/migrating-to-cache-components).
  cacheComponents: true,
  // partialPrefetching is left off on purpose: measured on 4G (2026-10-18), taps already show the
  // destination's loading placeholder in ~40 ms either way (every route has a loading.tsx), and with
  // it on each dashboard page load renders the signed-in layout twice (2 more database queries).
  // Memoises the big dashboard editors (those marked "use memo"), so typing re-renders only what
  // changed. Annotation mode keeps it off the guest pages: compiling everything added 6-13 KB and
  // some main-thread time there (Lighthouse, 2026-10-18), and guests come first.
  reactCompiler: { compilationMode: "annotation" },
  experimental: {
    // Failed navigations retry by themselves when the connection is back, and the till's
    // Online/Offline badge (next/offline) also notices a Wi-Fi that's up with no internet behind it.
    useOffline: true,
  },
  // Database drivers load native/wasm parts at runtime, so they stay out of the server bundle.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  // Dev only: let ngrok tunnels load the dev server's scripts (phones testing a QR code, demos).
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
