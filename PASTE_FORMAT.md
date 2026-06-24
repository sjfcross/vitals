# Nutrition Paste Format

Canonical format output by the Claude Project system prompt, parsed by `parsePaste()` in `LogMealSheet.jsx`.

## Rules

- One field per line, `Field: value`
- All 15 fields must be present; use `0` for unknown/absent values
- May be wrapped in a markdown code fence (` ``` `) — the parser ignores those lines
- **Bare numbers are still preferred**, but the parser is now lenient: approximation prefixes (`~`, `<`, `>`, `≈`) and trailing units (`g`, `mg`, `µg`, `kcal`) are tolerated on any field and stripped during parse. So `Protein: ~4.4g` parses as `4.4`.

## Fields

```
Description: <text>
Calories: <integer>
Protein: <decimal>
Fat: <decimal>
Saturated fat: <decimal>
Carbs: <decimal>
Sugar: <decimal>
Added sugar: <decimal>
Fibre: <decimal>
Sodium: <decimal>
Calcium: <decimal>
Iron: <decimal>
Potassium: <decimal>
Vitamin C: <decimal>
Vitamin D: <decimal>
```

## Example

```
Description: Chicken sandwich on sourdough with mayo
Calories: 481
Protein: 32
Fat: 18
Saturated fat: 4
Carbs: 42
Sugar: 5
Added sugar: 0
Fibre: 3
Sodium: 820
Calcium: 120
Iron: 3.2
Potassium: 410
Vitamin C: 4
Vitamin D: 0.8
```

## Parser behaviour

- `Description` → text field, trimmed
- All numeric fields → `parseFloat()` on the captured `[\d.]+` group; trailing units are excluded by the regex
- Every field's separator is `[:\s~<>≈]+`, so any approximation prefix (`~`, `<`, `>`, `≈`) between the colon and the number is absorbed — not just `Added sugar`
- A legitimate `0` is preserved (e.g. `Vitamin C: 0` stores `0`, not blank). This is handled by a `blank()` helper instead of the old `|| ''`, which used to wipe zeros
- Code fence lines (` ``` `) → no pattern matches them; ignored
- Missing field → empty string `''` stored in form state (not `NaN`)

## History

Before the 2026-06-24 fix, the separator was `[:\s]+` (colon + whitespace only), so a `~`-prefixed value like `Protein: ~4.4g` failed to match and the field came back empty — only `Calories` (no tilde) and `Added sugar` (the one field that already allowed `~`) parsed. Zeros were additionally wiped by `0 || ''`. Both are fixed.
