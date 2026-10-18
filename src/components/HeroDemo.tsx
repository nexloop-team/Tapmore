"use client";

import { useEffect, useState } from "react";

const DEMO = "/s?i=demo&s=home&embed=1";

/**
 * The phone in the home page's hero. A picture of the demo page shows at
 * once (it is the hero's largest image); the live demo, a whole second page
 * with its own scripts, loads over it once the page has settled, or as soon
 * as a pointer or finger reaches the phone. Phones asking to save data keep
 * the picture until touched.
 *
 * The picture is a screenshot of DEMO at 300×630 CSS pixels, 2× (WebP): take
 * a new one when the demo's look changes.
 */
export function HeroDemo() {
  const [live, setLive] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (live) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    let idle: number | undefined;
    const settle = window.setTimeout(() => {
      idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(() => setLive(true), { timeout: 3000 }) : window.setTimeout(() => setLive(true), 0);
    }, 2500);
    return () => {
      window.clearTimeout(settle);
      if (idle !== undefined && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
    };
  }, [live]);

  const wake = () => setLive(true);

  return (
    <div className="phone-screen hero-demo" onPointerEnter={wake} onTouchStart={wake}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed, pre-sized screenshot */}
      <img src="/demo/hero-poster.webp" alt="" width={300} height={630} fetchPriority="high" />
      {live && <iframe src={DEMO} title="Example venue page" tabIndex={-1} className={shown ? "is-shown" : undefined} onLoad={() => setShown(true)} />}
    </div>
  );
}
