# free-exercise-db (bundled exercise metadata)

`free-exercise-db.json` is a field-trimmed copy of `dist/exercises.json` from
[yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), pinned to commit
`f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5` (2026-09-27).

- **License:** The Unlicense (public domain dedication), per the repo's `LICENSE.md` at that commit.
  The dataset is itself restructured from [wrkout/exercises.json](https://github.com/wrkout/exercises.json),
  also released under The Unlicense. No attribution is required; this note is kept for provenance.
- **Images are not committed.** The two start/end photos per exercise are loaded on demand from
  jsDelivr (`cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@<commit>/exercises/...`) with a fallback to
  `raw.githubusercontent.com` at the same commit — see `src/lib/gymLibrary.js`.
- **Regenerate / bump the pin:** `node scripts/update-exercise-db.mjs <commit-sha>`, then update
  `FREE_EXERCISE_DB_COMMIT` in `src/lib/gymLibrary.js` to the same sha.
