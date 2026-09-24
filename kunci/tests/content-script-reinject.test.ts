import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

const root = join(import.meta.dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const FILES = ['ext-api.js', 'login-intent.js', 'login-outcome.js', 'icon-place.js', 'content.js']

/**
 * background.js re-injects the content scripts after an extension reload, to catch
 * tabs that were already open. The manifest has ALREADY injected them into those
 * tabs at document_idle, and both copies declare the same top-level consts
 * (`outcome`, `intent`). The second batch therefore dies with
 * "SyntaxError: Identifier 'outcome' has already been declared", the page keeps
 * running the old orphaned script, and autofill silently stops working until the
 * tab is reloaded by hand.
 */
function isolatedWorld() {
  return vm.createContext({
    chrome: { runtime: {}, tabs: {} },
    console,
    location: { href: 'https://example.com/login', hostname: 'example.com' },
    document: {
      documentElement: {},
      querySelectorAll: () => [],
      addEventListener: () => undefined,
      readyState: 'complete',
    },
    window: { addEventListener: () => undefined, setTimeout: () => 0 },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
  })
}

function runFiles(ctx: vm.Context) {
  const errors: string[] = []
  for (const f of FILES) {
    try {
      vm.runInContext(read(`extension/${f}`), ctx, { filename: f })
    } catch (e) {
      errors.push(`${e instanceof Error ? e.constructor.name : typeof e}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return errors
}

describe('re-injecting the content scripts', () => {
  it('throws a SyntaxError without the guard, which is why the guard exists', () => {
    const ctx = isolatedWorld()
    runFiles(ctx)
    const second = runFiles(ctx)
    expect(second.join('\n')).toContain('SyntaxError')
    expect(second.join('\n')).toContain('already been declared')
  })

  it('content.js marks the isolated world before anything else can fail', () => {
    const ctx = isolatedWorld()
    // Stop right after the marker line: the rest of content.js needs a real page.
    const source = read('extension/content.js')
    const markerEnd = source.indexOf('globalThis.kunciContentLoaded = true') + 'globalThis.kunciContentLoaded = true'.length
    vm.runInContext(source.slice(0, markerEnd), ctx, { filename: 'content.js' })
    expect(vm.runInContext('globalThis.kunciContentLoaded === true', ctx)).toBe(true)
  })

  it('background.js probes the marker before injecting', () => {
    const bg = read('extension/background.js')
    const probe = bg.indexOf('globalThis.kunciContentLoaded')
    const inject = bg.indexOf("files: ['ext-api.js', 'login-intent.js'")
    expect(probe).toBeGreaterThan(-1)
    expect(inject).toBeGreaterThan(probe)
  })
})
