import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { candidateAppPaths, HELPER_APP_NAME, helperAppBundlePath, helperBinPath } from '../helper/build-helper-app.mjs'

describe('Kunci Helper.app install paths', () => {
  it('puts Finder sidebar Applications first', () => {
    const paths = candidateAppPaths()
    expect(paths[0]).toBe(`/Applications/${HELPER_APP_NAME}`)
    expect(paths[1]).toBe(join(homedir(), 'Applications', HELPER_APP_NAME))
  })

  it('only reports an app that is actually on disk', () => {
    // This used to assert null, which only held on a machine without the app.
    // Assert the real contract: whatever path comes back must contain the binary.
    const app = helperAppBundlePath()
    if (app !== null) {
      expect(existsSync(app)).toBe(true)
      expect(helperBinPath()).not.toBeNull()
    } else {
      expect(helperBinPath()).toBeNull()
    }
  })
})
