# Nutrition Paste Format

Canonical format output by the Claude Project system prompt, parsed by `parsePaste()` in `LogMealSheet.jsx`.

## Rules

- **Bare numbers only** — no units, no `~`, no `<`, no `>`, no `≈`
- One field per line, `Field: value`
- All 15 fields must be present; use `0` for unknown/absent values
- May be wrapped in a markdown code fence (` ``` `) — the parser ignores those lines

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
- All numeric fields → `parseFloat()` on the captured `[\d.]+` group; trailing units are already excluded by the regex
- Added sugar with `~` prefix (old format) → `[:\s~]+` separator absorbs the tilde; still parses correctly
- Code fence lines (` ``` `) → no pattern matches them; ignored
- Missing field → empty string `''` stored in form state (not `NaN`)
