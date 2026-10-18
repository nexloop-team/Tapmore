import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

// storage.ts reads DATA_DIR on load, so point it at a scratch directory first.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tapmore-upload-"));
process.env.DATA_DIR = dataDir;

afterAll(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** A camera-sized photo, as an upload. */
async function photo(width: number, height: number): Promise<File> {
  const bytes = await sharp({ create: { width, height, channels: 3, background: "#c86432" } }).jpeg({ quality: 95 }).toBuffer();
  return new File([new Uint8Array(bytes)], "IMG_0001.JPG", { type: "image/jpeg" });
}

describe("venue image uploads", () => {
  it("stores every upload as WebP, no bigger than its use needs", async () => {
    const { saveVenueMedia, readMedia } = await import("./services/media");
    for (const [kind, max] of [["logo", 512], ["cover", 1600], ["dish", 1200]] as const) {
      const url = await saveVenueMedia("ven_upload1", await photo(4000, 3000), kind);
      expect(url).toMatch(/^\/media\/ven_upload1\/img_[A-Za-z0-9]+\.webp$/);
      const stored = await readMedia("ven_upload1", url.split("/").pop()!);
      expect(stored?.contentType).toBe("image/webp");
      const meta = await sharp(stored!.bytes).metadata();
      expect(meta.format).toBe("webp");
      expect(Math.max(meta.width!, meta.height!)).toBe(max);
    }
  });

  it("never enlarges a small image", async () => {
    const { saveVenueMedia, readMedia } = await import("./services/media");
    const url = await saveVenueMedia("ven_upload1", await photo(300, 200), "cover");
    const meta = await sharp((await readMedia("ven_upload1", url.split("/").pop()!))!.bytes).metadata();
    expect([meta.width, meta.height]).toEqual([300, 200]);
  });

  it("refuses a file that only claims to be an image", async () => {
    const { saveVenueMedia } = await import("./services/media");
    const fake = new File([new TextEncoder().encode("<svg onload=alert(1)>")], "x.jpg", { type: "image/jpeg" });
    await expect(saveVenueMedia("ven_upload1", fake, "logo")).rejects.toThrow(/JPEG, PNG, WebP or GIF/);
  });
});
