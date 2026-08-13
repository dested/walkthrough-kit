// Copies skill/ into ~/.claude/skills/walkthrough so the walkthrough skill is
// available globally. Re-run after editing skill files.
//
// Run from the repo root: bun scripts/install-skill.ts
import { cpSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEST = join(homedir(), '.claude', 'skills', 'walkthrough')

mkdirSync(DEST, { recursive: true })
cpSync(join(ROOT, 'skill'), DEST, { recursive: true })
console.log(`installed skill -> ${DEST}`)
