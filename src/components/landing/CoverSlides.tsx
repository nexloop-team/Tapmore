"use client";

import { useEffect, useState } from "react";

const SLIDE_MS = 5000;

/**
 * The header's banner photos. One photo is just a photo; two to five take
 * turns every five seconds with a cross-fade (none when the phone asks for
 * reduced motion, or while the page is in the background). The first loads
 * eagerly as the page's main image; the rest only once it's on screen.
 */
export function CoverSlides({ images }: { images: string[] }) {
  const [shown, setShown] = useState(0);
  const many = images.length > 1;

  useEffect(() => {
    if (!many) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setShown((current) => (current + 1) % images.length);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [many, images.length]);

  return (
    <>
      {images.map((src, index) => (
        // eslint-disable-next-line @next/next/no-img-element -- merchant image on any host
        <img
          key={src}
          src={src}
          alt=""
          className={many ? `cover-slide${index === shown ? " on" : ""}` : undefined}
          fetchPriority={index === 0 ? "high" : "low"}
          loading={index === 0 ? "eager" : "lazy"}
        />
      ))}
      {many && (
        <span className="cover-dots" aria-hidden>
          {images.map((src, index) => (
            <span key={src} className={index === shown ? "on" : undefined} />
          ))}
        </span>
      )}
    </>
  );
}
