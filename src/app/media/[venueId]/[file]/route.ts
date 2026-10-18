import { readMedia } from "@/server/services/media";

/**
 * Public merchant images. Names are random and never reused, so a file
 * never changes: browsers and the CDN in front of the app keep it for a
 * year (`CDN-Cache-Control` lets the edge serve repeats without calling
 * this function or the bucket), and the name doubles as the ETag.
 */
const CACHE = "public, max-age=31536000, immutable";

export async function GET(request: Request, ctx: RouteContext<"/media/[venueId]/[file]">) {
  const { venueId, file } = await ctx.params;
  const etag = `"${file}"`;
  const headers = {
    "Cache-Control": CACHE,
    "CDN-Cache-Control": CACHE,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  const media = await readMedia(venueId, file);
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(media.bytes), { headers: { ...headers, "Content-Type": media.contentType } });
}
