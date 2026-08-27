import React from "react";
import { Helmet } from "react-helmet";
import publicSeo from "../../config/publicSeo.json";

const SITE_URL = "https://alanenglish.com.tw";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

const canonicalFor = path => path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;

export default function SeoHead({ path }) {
    const seo = publicSeo[path];
    if (!seo) return null;

    const canonical = canonicalFor(path);

    return (
        <Helmet>
            <title>{seo.title}</title>
            <meta name="description" content={seo.description} />
            <meta name="robots" content="index,follow" />
            <meta name="googlebot" content="index,follow" />
            <link rel="canonical" href={canonical} />
            <meta property="og:type" content="website" />
            <meta property="og:site_name" content="Alan English" />
            <meta property="og:title" content={seo.ogTitle} />
            <meta property="og:description" content={seo.description} />
            <meta property="og:url" content={canonical} />
            <meta property="og:image" content={DEFAULT_IMAGE} />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={seo.ogTitle} />
            <meta name="twitter:description" content={seo.description} />
            <meta name="twitter:image" content={DEFAULT_IMAGE} />
        </Helmet>
    );
}
