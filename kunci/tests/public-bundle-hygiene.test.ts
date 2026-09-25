import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')

// The app is served from a public URL, so everything compiled out of src/ can be
// read by anyone who fetches the bundle. AutofillView used to hardcode
// /Users/tiftazani/Cursor-Tifz as a fallback and spell out the git branch, which
// shipped the home folder and repo name to production.
//
// The recovery email and the cloud hostname are deliberately public: they are in
// RECOVERY_EMAIL and the deployed origin, not listed here.
const PERSONAL = [
  '/Users/tiftazani',
  '/Users/',
  'Cursor-Tifz',
  'tifz-apps',
  'cursor/kunci-password-manager-4eaf',
]

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|css|html)$/.test(name)) out.push(p)
  }
  return out
}

function scan(label: string, files: { path: string; text: string }[]) {
  const hits: string[] = []
  for (const { path, text } of files) {
    for (const needle of PERSONAL) {
      if (text.includes(needle)) hits.push(`${path}: ${needle}`)
    }
  }
  expect(hits, `${label} ships a personal path or repo name:\n  ${hits.join('\n  ')}`).toEqual([])
}

describe('the public bundle carries no personal paths', () => {
  it('keeps them out of every source file', () => {
    scan(
      'src/',
      walk(join(root, 'src')).map((path) => ({ path: path.slice(root.length + 1), text: readFileSync(path, 'utf8') })),
    )
  })

  it('keeps them out of the built bundle when one exists', () => {
    const assets = join(root, 'dist', 'assets')
    if (!existsSync(assets)) return
    const bundles = readdirSync(assets).filter((f) => f.endsWith('.js'))
    scan(
      'dist/assets',
      bundles.map((f) => ({ path: `dist/assets/${f}`, text: readFileSync(join(assets, f), 'utf8') })),
    )
  })

  it('takes the install commands from the helper instead of building them', () => {
    // The daemon knows the real paths; re-deriving them here is how the leak
    // happened. The view must render helperPull / helperInstall.
    const view = readFileSync(join(root, 'src/views/AutofillView.tsx'), 'utf8')
    expect(view).toContain('helperPull')
    expect(view).toContain('helperInstall')
    expect(view).not.toContain('ambilBranch')
  })

  it('hides the install guide behind a button, closed by default', () => {
    const view = readFileSync(join(root, 'src/views/AutofillView.tsx'), 'utf8')
    expect(view).toContain('Panduan pemasangan')
    // The steps must not be on screen until the button is pressed: the state has
    // to start false, and the list has to sit inside a conditional.
    expect(view).toContain('const [showGuide, setShowGuide] = useState(false)')
    expect(view).toContain('{showGuide ? (')
    expect(view).toContain('onClick={() => setShowGuide((v) => !v)}')
  })

  it('never prints the helper token as plain text', () => {
    // The token authorises /fill, which types a login into whatever Mac app is in
    // front. It sat in a TextInput, so it was readable on screen and in any
    // screenshot of the page.
    const view = readFileSync(join(root, 'src/views/AutofillView.tsx'), 'utf8')
    const field = view.slice(view.indexOf('Token helper'))
    const box = field.slice(0, field.indexOf('</Field>'))
    expect(box).toContain('<SecretInput')
    expect(box).not.toContain('<TextInput')
  })
})
