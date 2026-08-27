import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const buildDirectory = path.join(projectRoot, "build");
const seoConfigPath = path.join(projectRoot, "src", "config", "publicSeo.json");
const siteUrl = "https://alanenglish.com.tw";

const escapeHtml = value => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const canonicalFor = route => route === "/" ? `${siteUrl}/` : `${siteUrl}${route}`;

const replaceRequired = (html, pattern, replacement, label) => {
    if (!pattern.test(html)) throw new Error(`找不到要更新的 SEO 標籤：${label}`);
    return html.replace(pattern, replacement);
};

export const renderSeoHtml = (template, route, seo) => {
    const canonical = canonicalFor(route);
    const title = escapeHtml(seo.title);
    const description = escapeHtml(seo.description);
    const ogTitle = escapeHtml(seo.ogTitle);

    let html = replaceRequired(template, /<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`, "title");
    html = replaceRequired(html, /<meta\b[^>]*\bname="description"[^>]*\/>/i, `<meta data-react-helmet="true" name="description" content="${description}" />`, "description");
    html = replaceRequired(html, /<link\b[^>]*\brel="canonical"[^>]*\/>/i, `<link data-react-helmet="true" rel="canonical" href="${canonical}" />`, "canonical");
    html = replaceRequired(html, /<meta\b[^>]*\bproperty="og:title"[^>]*\/>/i, `<meta data-react-helmet="true" property="og:title" content="${ogTitle}" />`, "og:title");
    html = replaceRequired(html, /<meta\b[^>]*\bproperty="og:description"[^>]*\/>/i, `<meta data-react-helmet="true" property="og:description" content="${description}" />`, "og:description");
    html = replaceRequired(html, /<meta\b[^>]*\bproperty="og:url"[^>]*\/>/i, `<meta data-react-helmet="true" property="og:url" content="${canonical}" />`, "og:url");
    html = replaceRequired(html, /<meta\b[^>]*\bname="twitter:title"[^>]*\/>/i, `<meta data-react-helmet="true" name="twitter:title" content="${ogTitle}" />`, "twitter:title");
    html = replaceRequired(html, /<meta\b[^>]*\bname="twitter:description"[^>]*\/>/i, `<meta data-react-helmet="true" name="twitter:description" content="${description}" />`, "twitter:description");
    return html;
};

export const renderNoIndexHtml = template => {
    let html = replaceRequired(template, /<title>[\s\S]*?<\/title>/i, "<title>Alan English｜帳號與會員服務</title>", "noindex title");
    html = replaceRequired(html, /<meta\b[^>]*\bname="description"[^>]*\/>/i, '<meta data-react-helmet="true" name="description" content="Alan English 帳號、會員、付款與學習服務頁面。" />', "noindex description");
    html = replaceRequired(html, /<meta\b[^>]*\bname="robots"[^>]*\/>/i, '<meta data-react-helmet="true" name="robots" content="noindex,nofollow" />', "robots");
    html = replaceRequired(html, /<meta\b[^>]*\bname="googlebot"[^>]*\/>/i, '<meta data-react-helmet="true" name="googlebot" content="noindex,nofollow" />', "googlebot");
    html = replaceRequired(html, /<link\b[^>]*\brel="canonical"[^>]*\/>/i, "", "noindex canonical");
    return html;
};

export async function generateStaticSeoPages() {
    const [template, configText] = await Promise.all([
        readFile(path.join(buildDirectory, "index.html"), "utf8"),
        readFile(seoConfigPath, "utf8")
    ]);
    const publicSeo = JSON.parse(configText);

    for (const [route, seo] of Object.entries(publicSeo)) {
        const html = renderSeoHtml(template, route, seo);
        const outputPath = route === "/"
            ? path.join(buildDirectory, "index.html")
            : path.join(buildDirectory, `seo-${route.slice(1).replaceAll("/", "-")}.html`);
        await writeFile(outputPath, html, "utf8");
    }

    await writeFile(path.join(buildDirectory, "noindex.html"), renderNoIndexHtml(template), "utf8");

    console.log(`已產生 ${Object.keys(publicSeo).length} 個公開路由的 SEO HTML 與通用 noindex HTML。`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await generateStaticSeoPages();
}
