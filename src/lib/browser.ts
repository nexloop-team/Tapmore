/** Browser-only helpers. Every function here must be called from an event handler or effect. */

type PlatformKey = "ios" | "android" | "windows" | "mac" | "unknown";

export function getPlatform(): PlatformKey {
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  return "unknown";
}

/**
 * For useSyncExternalStore reads of values that never change during a visit
 * (platform, localStorage on load): the server snapshot renders first, the
 * client value right after hydration, without an effect.
 */
export const subscribeNever = () => () => {};

/** "smooth", unless the person asked their device for less motion: then scrolling jumps. */
export function scrollMotion(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/**
 * For useSyncExternalStore reads of localStorage that another tab may change:
 * opening the card link from an email saves the card there, and the guest
 * page already open in another tab picks it up at once.
 */
export function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const temp = document.createElement("textarea");
  temp.value = value;
  temp.setAttribute("readonly", "");
  temp.style.position = "absolute";
  temp.style.left = "-9999px";
  document.body.appendChild(temp);
  temp.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(temp);
  if (!ok) throw new Error("Copy failed");
}

/** Whether this browser keeps what the page stores (private modes and blocked storage don't). */
export function storageWorks(): boolean {
  try {
    window.localStorage.setItem("tt.probe", "1");
    window.localStorage.removeItem("tt.probe");
    return true;
  } catch {
    return false;
  }
}

/** localStorage that never throws: private windows and blocked storage just forget. */
const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* the device simply won't remember */
    }
  },
};

export interface CardCredentials {
  cardId: string;
  token: string;
}

/** The id and private token in a card link (`/card/<id>?t=<token>`), or null. */
export function cardCredentialsFromUrl(url: string | null | undefined): CardCredentials | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, "http://local");
    const match = /^\/card\/(crd_[A-Za-z0-9]+)$/.exec(parsed.pathname);
    const token = parsed.searchParams.get("t");
    return match && token ? { cardId: match[1], token } : null;
  } catch {
    return null;
  }
}

export function parseCardCredentials(raw: string | null): CardCredentials | null {
  try {
    const value = JSON.parse(raw ?? "null") as CardCredentials | null;
    return value && /^crd_[A-Za-z0-9]+$/.test(value.cardId) && typeof value.token === "string" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Per-venue device memory. Only opaque ids are stored (the customer id, and
 * the card's id and private token so the guest page can show the card) —
 * never the guest's email or name.
 */
export const deviceMemory = {
  customerId: (venueId: string) => safeStorage.get(`tt.customer.${venueId}`),
  rememberCustomer: (venueId: string, customerId: string) => safeStorage.set(`tt.customer.${venueId}`, customerId),
  /** The stored value as a string, stable enough for useSyncExternalStore; parse with `parseCardCredentials`. */
  cardRaw: (venueId: string) => safeStorage.get(`tt.card.${venueId}`),
  rememberCard: (venueId: string, card: CardCredentials) => safeStorage.set(`tt.card.${venueId}`, JSON.stringify(card)),
  forgetCard: (venueId: string) => safeStorage.set(`tt.card.${venueId}`, "null"),
};

/**
 * Makes a big camera photo light enough to upload quickly on mobile data:
 * scaled to `maxDim` and re-encoded as JPEG. PNG, GIF and WebP files (logos
 * with transparency, animations) and photos already small are sent as they
 * are; the server re-encodes every upload anyway.
 */
export async function shrinkPhotoForUpload(file: File, maxDim = 2400, quality = 0.85): Promise<File> {
  if (file.type !== "image/jpeg" || file.size < 1_500_000) return file;
  try {
    const { dataUrl } = await compressImage(file, maxDim, quality);
    const blob = await (await fetch(dataUrl)).blob();
    return blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/**
 * Downscales a photo to at most 1200px on its longest side and re-encodes it
 * as JPEG 0.7 — small enough to post inline, and it strips EXIF location.
 */
export function compressImage(file: File, maxDim = 1200, quality = 0.7): Promise<{ base64: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve({ base64: dataUrl.split(",")[1] ?? "", dataUrl });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
