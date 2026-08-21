#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, stdio: 'inherit', shell: false })
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))))
  })
}

function runQuiet(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'ignore' })
    child.on('close', () => resolve())
    child.on('error', () => resolve())
  })
}

console.log('Menghentikan proses lama di port 8780 (kalau ada)…')
await runQuiet('bash', ['-lc', 'pids=$(lsof -tiTCP:8780 -sTCP:LISTEN 2>/dev/null); if [ -n "$pids" ]; then kill -9 $pids; fi'])

console.log('Build produksi…')
await run('npm', ['run', 'build'])

console.log('\nBuka http://127.0.0.1:8780 — biarkan Terminal ini terbuka.\n')
await run('node', ['helper/daemon.mjs', '--serve-ui'])
