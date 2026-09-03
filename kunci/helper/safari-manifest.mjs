export function toSafariManifest(manifest) {
  return {
    ...manifest,
    background: {
      scripts: ['background.js'],
      type: 'module',
      persistent: false,
    },
    browser_specific_settings: {
      ...(manifest.browser_specific_settings || {}),
      safari: {
        strict_min_version: '16.4',
        ...(manifest.browser_specific_settings?.safari || {}),
      },
    },
  }
}
