import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const buildDirectory = path.join(projectRoot, "build");
const publicSeo = JSON.parse(await readFile(path.join(projectRoot, "src", "config", "publicSeo.json"), "utf8"));

const canonicalFor = route => route === "/"
    ? "https://alanenglish.com.tw/"
    : `https://alanenglish.com.tw${route}`;

test("公開 SEO 路由都有獨立的靜態 title、description 與 canonical", async () => {
    for (const [route, seo] of Object.entries(publicSeo)) {
        const htmlPath = route === "/"
            ? path.join(buildDirectory, "index.html")
            : path.join(buildDirectory, `seo-${route.slice(1).replaceAll("/", "-")}.html`);
        const html = await readFile(htmlPath, "utf8");
        const canonical = canonicalFor(route);

        assert.match(html, new RegExp(`<title>${seo.title}</title>`));
        assert.ok(html.includes(`name="description" content="${seo.description}"`));
        assert.ok(html.includes(`rel="canonical" href="${canonical}"`));
        assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    }
});

test("舊首頁路由使用 301，SPA fallback 保持最後一條", async () => {
    const redirects = await readFile(path.join(projectRoot, "public", "_redirects"), "utf8");
    const rules = redirects.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const parsedRules = rules.map(rule => rule.split(/\s+/));

    assert.ok(parsedRules.some(rule => rule[0] === "/home" && rule[1] === "/" && rule[2] === "301"));
    assert.ok(parsedRules.some(rule => rule[0] === "/showcase" && rule[1] === "/" && rule[2] === "301"));
    for (const route of ["links", "shop", "materials"]) {
        assert.ok(parsedRules.some(rule => rule[0] === `/${route}` && rule[1] === `/seo-${route}.html` && rule[2] === "200"));
    }
    assert.deepEqual(parsedRules.at(-1), ["/*", "/noindex.html", "200"]);
});

test("登入、付款、會員後台與未知路由共用靜態 noindex HTML", async () => {
    const html = await readFile(path.join(buildDirectory, "noindex.html"), "utf8");

    assert.ok(html.includes('name="robots" content="noindex,nofollow"'));
    assert.ok(html.includes('name="googlebot" content="noindex,nofollow"'));
    assert.equal((html.match(/rel="canonical"/g) || []).length, 0);
});

test("sitemap 只列出目前四個可索引公開頁", async () => {
    const sitemap = await readFile(path.join(projectRoot, "public", "sitemap.xml"), "utf8");
    const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);

    assert.deepEqual(urls, Object.keys(publicSeo).map(canonicalFor));
});
