/** Shared Cuciin shop document. HP kasir/owner nge-share lewat /api/cuciin. */
export const CUCIIN_STORE_URL =
  "https://extendsclass.com/api/json-storage/bin/ccdbcfc";

/** Optional extra replica. Filled by CI if empty. */
export const CUCIIN_JSONBLOB_ID = process.env.CUCIIN_JSONBLOB_ID ?? "";

export const CUCIIN_CLOUD_KEY = process.env.CUCIIN_CLOUD_KEY ?? "";
