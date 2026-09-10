import { describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { candidateAppPaths, HELPER_APP_NAME, helperAppBundlePath, helperBinPath } from '../helper/build-helper-app.mjs'

describe('Kunci Helper.app install paths', () => {
  it('puts Finder sidebar Applications first', () => {
    const paths = candidateAppPaths()
    expect(paths[0]).toBe(`/Applications/${HELPER_APP_NAME}`)
    expect(paths[1]).toBe(join(homedir(), 'Applications', HELPER_APP_NAME))
  })

  it('does not report an app that is not on disk', () => {
    expect(helperAppBundlePath()).toBeNull()
    expect(helperBinPath()).toBeNull()
  })
})
