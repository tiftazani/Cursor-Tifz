import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(import.meta.dirname, '..', 'extension', 'content.js'), 'utf8')

/**
 * ensureButton(pw, usernameOnly = false) decides whether a field may carry the fill
 * icon. `passwords.forEach(ensureButton)` handed it the array index as `usernameOnly`:
 * the first password got 0 (falsy, fine) and every later one got 1, 2, 3... (truthy).
 * Those fields were then checked with the username-only-step rule, which a password
 * box never satisfies, so the icon vanished from the second password field.
 */
function ensureButton(usernameOnly: unknown) {
  // Mirrors the guard at the top of ensureButton in content.js.
  const allowed = usernameOnly ? 'username-only-rule' : 'autofill-rule'
  return allowed
}

describe('every password field is judged by the autofill rule', () => {
  it('a bare forEach would pass the index, which is why the loop is explicit', () => {
    const indexes: unknown[] = []
    const collect = (pw: string, i: number) => {
      indexes.push(i)
      return pw
    }
    ;['a', 'b', 'c'].forEach(collect)
    // Index 0 is falsy, so only the first field survived. This is the bug, shown.
    expect(indexes.map((i) => ensureButton(i))).toEqual(['autofill-rule', 'username-only-rule', 'username-only-rule'])
  })

  it('content.js uses an explicit loop, so usernameOnly stays false', () => {
    // Strip comments first: the note explaining the bug quotes the old call.
    const code = source.replace(/\/\/[^\n]*/g, '')
    expect(code).not.toContain('passwords.forEach(ensureButton)')
    expect(code).toContain('for (const pw of passwords) ensureButton(pw)')
  })

  it('the username-only call still opts in on purpose', () => {
    expect(source).toContain('if (userOnly) ensureButton(userOnly, true)')
  })
})
