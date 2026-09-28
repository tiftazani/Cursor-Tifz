/**
 * The site rules live in extension/site.js so the unpacked extension and the app build
 * share one copy. That file is plain JS; this is the typed door into it.
 *
 * Why this matters: Kunci decides whether a saved login belongs to the page in front of
 * you, and the old rule ("take the last two labels") is wrong for every shared host.
 * Surge, GitHub Pages, Netlify, Vercel and S3 each give every customer a name under one
 * suffix, so `pelindo-kpi-monitoring.surge.sh` and `surge.sh` are different sites while
 * one string contains the other. See extension/public-suffix.js for the rule data.
 */
export { isPublicSuffix, registrableDomain, siteLabel, storedUrl } from '../../extension/site.js'
