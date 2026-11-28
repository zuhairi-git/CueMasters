---
name: verify
description: How to verify changes in Cue Master. Use after any code, style or content change, and whenever asked to check, test, run or preview the game.
---

# Verifying Cue Master changes

Verify with the automated checks only:

```
npm test
npm run build
```

- `npm test` runs the Node test suite (physics, rules, career, challenges, saved state, i18n, online).
- `npm run build` type-checks with `tsc --noEmit` and produces the production bundle.

Rules:

- Do **not** start a localhost server (`npm run dev`, `npm start`, `vite preview`, or any other server).
- Do **not** open or drive a browser to verify the game (no preview pane, no screenshots, no Chrome automation).
- Visual, touch and responsive review is done by the project owner on real devices. When a change is
  visual, describe what changed and which screens/sizes to look at instead of checking it yourself.
- Any change to colours, backgrounds, glass surfaces, themes or text must also follow the `contrast` skill:
  `tests/contrast.test.mjs` (part of `npm test`) has to keep every text/surface pairing at WCAG AA.
- If a layout or gameplay value needs checking, do it with a test or a Node script against `src/`
  (see `tests/load-source.mjs`), not in a browser.
