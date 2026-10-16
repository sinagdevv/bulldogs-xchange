import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const publicFile = (name: string) => readFileSync(new URL(`../frontend/public/${name}`, import.meta.url));

describe("installable PWA artifacts", () => {
  it("uses the NU standalone manifest and correctly sized maskable icons", () => {
    const manifest = JSON.parse(publicFile("manifest.webmanifest").toString("utf8"));
    expect(manifest).toMatchObject({ name: "Bulldogs Xchange", short_name: "Xchange", start_url: "/", scope: "/", display: "standalone", background_color: "#071b36", theme_color: "#071b36" });
    expect(manifest.icons.map((icon: { sizes: string; purpose: string }) => [icon.sizes, icon.purpose])).toEqual([["192x192", "any maskable"], ["512x512", "any maskable"]]);
    for (const size of [192, 512]) {
      const icon = publicFile(`icon-${size}.png`);
      expect(icon.toString("ascii", 1, 4)).toBe("PNG");
      expect([icon.readUInt32BE(16), icon.readUInt32BE(20)]).toEqual([size, size]);
    }
  });

  it("keeps APIs network-only and uses a versioned network-first app shell", () => {
    const worker = publicFile("sw.js").toString("utf8");
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('request.method!=="GET"');
    expect(worker).toContain('if(request.mode==="navigate"){event.respondWith(fetch(request)');
    expect(worker).toMatch(/const CACHE="bulldogs-static-v\d+"/);
    expect(worker).toContain("keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))");
  });
});
