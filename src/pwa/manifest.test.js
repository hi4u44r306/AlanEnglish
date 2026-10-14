const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "..", "..", "public");
const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, "manifest.json"), "utf8"));
const html = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");

describe("PWA install contract", () => {
    test("manifest is installable and enters through the role-aware route", () => {
        expect(manifest.display).toBe("standalone");
        expect(manifest.start_url).toBe("/userinfo?source=pwa");
        expect(manifest.theme_color).toBe("#073763");
        expect(manifest.background_color).toBe("#073763");
        const purposes = manifest.icons.map(icon => `${icon.sizes}:${icon.purpose}`);
        expect(purposes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "192x192:maskable", "512x512:maskable"]));
        manifest.icons.forEach(icon => expect(fs.existsSync(path.join(publicDir, icon.src))).toBe(true));
    });

    test("iOS meta tags and every startup image file exist", () => {
        expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
        const images = [...html.matchAll(/apple-touch-startup-image"[^>]*href="%PUBLIC_URL%\/([^"]+)"/g)].map(m => m[1]);
        expect(images.length).toBeGreaterThanOrEqual(10);
        images.forEach(file => expect(fs.existsSync(path.join(publicDir, file))).toBe(true));
    });

    test("service worker does not cache or answer requests", () => {
        const worker = fs.readFileSync(path.join(publicDir, "web-push-sw.js"), "utf8");
        expect(worker).not.toMatch(/respondWith|caches\./);
    });
});
