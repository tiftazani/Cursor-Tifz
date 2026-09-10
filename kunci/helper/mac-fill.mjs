#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const daemon = join(root, 'helper', 'daemon.mjs')
const withUi = process.argv.includes('--with-ui')

spawn(process.execPath, [daemon], { stdio: 'inherit', cwd: root })
if (withUi) {
  spawn('npm', ['run', 'dev'], { stdio: 'inherit', cwd: root, shell: true })
}
