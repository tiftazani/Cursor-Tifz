;(() => {
  const g = globalThis
  if (typeof g.chrome === 'undefined' && typeof g.browser !== 'undefined') g.chrome = g.browser
  if (typeof g.browser === 'undefined' && typeof g.chrome !== 'undefined') g.browser = g.chrome
})()
