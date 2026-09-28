/**
 * The site rules live in extension/site.js so the unpacked extension and the app build
 * share one copy. The extension loads plain JS; this declaration is what lets src/ import
 * the same file with types. tests/site-rules.test.ts fails if the two ever drift.
 */
export declare function siteLabel(host: string): string
export declare function registrableDomain(host: string): string
export declare function isPublicSuffix(host: string): boolean
export declare function storedUrl(raw: string): string
