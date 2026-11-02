/* global process */
// Regenerates src/data/free-exercise-db.json from yuhonas/free-exercise-db (Unlicense / public domain).
//
//   node scripts/update-exercise-db.mjs [commit-sha]
//
// The commit is pinned so the bundled metadata and the on-demand images (jsDelivr / raw GitHub,
// see src/lib/gymLibrary.js -> FREE_EXERCISE_DB_COMMIT) always come from the same snapshot.
// If you change the commit here, change FREE_EXERCISE_DB_COMMIT too.
import { writeFile } from 'node:fs/promises'

const commit = process.argv[2] || 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'
const url = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${commit}/dist/exercises.json`

const res = await fetch(url)
if (!res.ok) throw new Error(`${res.status} fetching ${url}`)
const raw = await res.json()

// Keep only the fields the app uses, in a stable order.
const slim = raw.map(e => ({
  id: e.id,
  name: e.name,
  force: e.force ?? null,
  level: e.level ?? null,
  mechanic: e.mechanic ?? null,
  equipment: e.equipment ?? null,
  primaryMuscles: e.primaryMuscles ?? [],
  secondaryMuscles: e.secondaryMuscles ?? [],
  instructions: e.instructions ?? [],
  category: e.category ?? null,
  images: e.images ?? [],
})).sort((a, b) => a.id.localeCompare(b.id))

await writeFile(new URL('../src/data/free-exercise-db.json', import.meta.url), JSON.stringify(slim))
console.log(`Wrote ${slim.length} exercises from ${commit}`)
