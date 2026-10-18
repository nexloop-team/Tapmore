"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * How fast pages really load on guests' and owners' phones (Vercel Speed
 * Insights: loading, responsiveness and layout-shift figures, no cookies).
 * Only the route's shape is sent ("/card/[id]", "/s"), never the address
 * itself: card links carry a private token, and query strings name venues
 * and tables.
 */
export function RealUserSpeed() {
  return (
    <SpeedInsights
      beforeSend={(event) => {
        // No route shape known: send nothing rather than a path that may hold a card id.
        if (!event.route) return null;
        return { ...event, url: `${new URL(event.url).origin}${event.route}` };
      }}
    />
  );
}
