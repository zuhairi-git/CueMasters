---
name: contrast
description: Keep every piece of text in Cue Master readable. Use whenever a change touches colours, backgrounds, glass panes, themes, overlays or adds/moves any text — and before calling any visual change done.
---

# Text contrast in Cue Master

Text contrast is a hard requirement for this project. Every label, number and hint must reach
**WCAG AA: 4.5:1** against the worst thing that can be behind it (3:1 only for purely decorative
marks such as unearned stars). "It looks fine on the default theme" is not a check.

## How contrast is enforced

- `src/glass.css` is loaded last and owns the colours. Text colours are **`--ink-*` tokens**, the
  surfaces they sit on are **`--pane-*` tokens** (plus the solid `--panel`, `--control`, `--hover`).
- Tokens are declared in four `/* @tokens … */` blocks: `club` (default), `midnight`, `ivory`, and
  `table` (everything drawn over the cloth, dark in every theme).
- `tests/contrast.test.mjs` composites each pane stack over the brightest and darkest backdrop it
  can meet (veiled photos, the plain page with its glow, every cloth colour, artwork), adds the
  sheen and pointer glare, and fails if any pairing drops below AA. It also fails if
  - an `--ink-*` token exists that no pairing checks, or
  - `glass.css` sets a `color:` that is not an `--ink-*` token.

Run it on its own while tuning:

```
node --test tests/contrast.test.mjs
```

A failure prints the theme, the ink, the pane stack, the place, the ratio and the backdrop that
broke it. Fix the tokens (darker/more opaque pane, lighter/darker ink, weaker sheen); never lower
the threshold and never delete a pairing to get green.

## Rules when changing anything visual

1. **No literal text colours.** Use an existing `--ink-*` token. Need a new one? Add it to every
   `@tokens` block that should differ and add a pairing for it in the test.
2. **New surface or new stacking = new pairing.** If text lands on a pane it did not sit on before
   (a chip on a card, a tint over a seat, a new overlay), add `{ where, themes, ink, on, over }` to
   `pairs` in the test. `on` is the stack bottom-to-top; `over` names the backdrops.
3. **Translucent means "judge it over the worst backdrop".** Glass over a photo or the cloth is
   only as dark as what shows through. If a new background, cloth colour or venue is added, add its
   brightest and darkest colour to `felt`/`brightestPhoto` in the test.
4. **Highlights count.** A sheen, glare, gradient top or hover lightening changes the surface under
   the text. Mirror it in `finishes` in the test.
5. **Text straight on a picture needs a veil or a chip.** Photos get `--veil`; badges over artwork
   carry `--pane-badge`. Do not rely on text-shadow for contrast.
6. **Older stylesheets** (`arcade.css`, `hud.css`, `city-picker.css`, `game.css`) still contain
   literal colours. When you touch such a rule, or change the surface under it, move its colour to
   an ink token in `glass.css` and add the pairing.
7. **Check all three themes plus the table palette.** Ivory is the light theme: its panes are
   light and its inks dark, so a fix for the dark themes can break it.

## Sweep: every place text appears

Walk this list for any visual change and make sure each spot you affected has a pairing.
Each item applies in **Clubhouse, Midnight and Ivory** unless marked *(table palette)*.

**Loader** — "Setting the table" label on the loader card.

**Home** (photo backgrounds Sapphire/Golden, glow backgrounds Emerald/Twilight, Classic plain page)
- kicker pill, headline, tagline
- wallet chips: value, label, gold coin/star values
- game switch: 8-Ball / 9-Ball / Snooker, pressed and not pressed
- mode cards: title, description, action button (four pastel fills)
- Resume / Play with an invite / Install buttons, install help panel

**Selection screens** (career cities, stages, shop, training, difficulty, challenges, online cities)
- back/shop buttons, screen title, status chip
- tier headings and their star counts (on the plain page and over photos)
- cards: subtitle, title, detail, action pill, star row
- over artwork: status badge (unlocked/locked/completed), stage number, final ribbon
- final card: gold title on the gold-tinted pane

**Dialogs** (app settings, background picker, game settings, game menu, player details, spin,
online/profile, re-rack, end game, snooker concession, TV detection)
- title, eyebrow, legends, field labels, helper text and notes
- buttons: normal, hover, primary, switched on (`aria-pressed`), disabled
- selects and their option lists, language buttons, avatar picker, background options
- game menu rows: label, description, icon, pressed row
- links and status lines (invite link, online status, spin read-out, medals)

**Match HUD** *(table palette; over every cloth: green, blue, burgundy, snooker red, city and
championship cloths)*
- heading strip: match name, status hint, career objective, shot clock (normal and urgent)
- scoreboard: player name, group/score text, "Playing" tag, empty tray text — active and inactive seat
- ball-on chip: label, ball name, "then …"
- icon buttons (normal, hover, pressed, disabled) and their labels in the phone menu
- shot controls: labels, power read-out, aim lock, zoom rail, fine-aim hint
- phones: the floating hint chip and objective chip, the menu button, the Details toggle
- TV mode: step, help and power text

**Over the table** *(table palette)*
- pocket picker, full-screen notice
- shot callouts: normal, streak ("great") and foul ("warn")
- incredible-shot banner and Skip replay
- match intro: eyebrow, title, versus pill, detail, hint — normal and final
- result card: label, title, detail, player names, Winner tag, stars, every button state

## Reporting

Contrast is verified by the test, not in a browser (see the `verify` skill). In the summary of a
visual change say which pairings were added or retuned, and list the screens and themes the owner
should eyeball.
