# 3D Billiard

Run `npm install` and `npm run dev` for development. For a production server, run
`npm run build` followed by `npm start` (port 3000, or the `PORT` environment variable).
The Node server serves the built game and its WebSocket multiplayer endpoint.
A static file host alone does not support online games.

## Play

- Choose **Billiard** (eight-ball) or **Snooker** on the homepage. Each game
  has its own career progress, equipment, challenge completions, and saved match.
  Win ten full games in each city in **Computer Career** to open the next city.
  Open **Challenges** for preset shots and **Training** for practice.
  First clears earn career points and coins. Optional skill goals pay a one-time
  bonus and can be earned on replays. Points determine your career rank, and
  finishing a city unlocks a themed table finish in **Settings → Table**.
  The London Championship is best-of-three.
  Spend coins on cue upgrades in
  the **Equipment shop** on the career screen. Career progress and equipment
  live in your browser, and cities unlocked before the update remain accessible.
  In the Billiard online circuit, your first win in each city completes the city and adds
  its cosmetic medal to your player profile. Matchmaking pairs players in the
  same city. Online progress and medals follow your player ID
  on the same server and is saved to `.billiard-circuit.json` by default. Set
  `CIRCUIT_DATA_FILE` to a persistent writable path when hosting the game.
- Training lets you control both seats or practice against the computer at any
  difficulty. Try any cue's power and spin characteristics under **Settings → Cue**.
  You can re-rack freely and change the ruleset in Settings.

The default overhead table uses SVG artwork for the table, cushions, cue, and
balls. The scoreboard and player details share the same SVG ball artwork.
Choose **3D view** or **Orbit** to use the Babylon scene. TV mode retains its
lightweight Canvas 2D renderer. All views use the same physics and match state.

- On a keyboard, **Left/Right** rotate aim by one degree. Hold **Shift** or use
  **Up/Down** for one-tenth-degree adjustments. Unlock aim before adjusting;
  shortcuts pause while a dialog is open, a shot is moving, or you are typing.
- Click the **Spin** ball to open the contact-point popup. Drag the marker or use
  arrow keys, choose **Reset spin** to center it, then **Done** to return to play.
- Choose **Full screen** in the table controls (or the game menu on TV/mobile)
  to hide browser navigation. Choose **Exit full screen** to bring it back.
  Escape or the browser's own exit control also works. Fullscreen availability
  depends on the browser; older WebKit TV fullscreen controls are supported.
- Turn on **Settings → Play on TV** for a remote-friendly, fitted overhead view.
  Recognized TV browsers ask whether to enable it on their first visit and remember
  the answer. TV mode draws a separate lightweight Canvas 2D table, without WebGL;
  the regular 3D table and room keep their existing design. If WebGL cannot start,
  the game uses the compatibility table while respecting your TV controls setting.
  With TV controls off, the compatibility table supports pointer aiming, cue-ball
  placement, pocket selection and pull-back shooting. Switching from a TV-only startup
  back to 3D reloads the game and restores the saved match when browser storage is available.
  Arrows place the cue ball; OK keeps its position. Left/right aim, up/down fine-tune;
  OK moves to power. Up/down changes power, then OK shoots. When playing the eight,
  choose its pocket with arrows and OK first. Back returns to aiming or opens the menu.
  In menus, up/down moves focus, left/right changes a setting, and OK selects.
  The TV setting is remembered on this device. Use a remote that sends directional,
  OK and Back keys to the browser (a keyboard works too).
- Practice controls both sides of a two-player game. Settings also offers a computer opponent.
- **Start new game** in Settings asks before discarding a game already in progress.
- Click outside a dialog to dismiss it. Confirmation dialogs treat this as cancellation.
- Eight-ball displays each player's solids/stripes assignment and remaining balls.
  The break leaves the table open. A legal pot after the break assigns groups.
  Pot your group before the eight, then call its pocket by tapping a pocket or using
  the control selector. Potting the eight early, into another pocket, or scratching on it loses.
  This is a friendly ruleset without called pockets or formal tournament break requirements.
- Aim by tapping or dragging on the felt. Double-tap/click the cue ball, or use **Lock aim**,
  then drag opposite the cue direction on the table and release to shoot. Power is shared
  with the bottom cue control. Every shot unlocks aim automatically.
- The dashed guide predicts the object ball's initial path and highlights an aligned pocket.
  It stops at another ball or a cushion; it does not predict subsequent banks or full-shot outcomes.
  **Shot guides** in Settings turns all guides on/off, defaults to on, and remembers the choice.
- The game saves locally every half second and when the page hides. Refresh restores an
  unfinished shot as well as the ball positions, players, turn, groups and scores.
- The camera ruler on the right zooms from 0.65× to 2.5×. Drag its marker, use +/−,
  or tap the magnification to return to the fitted table view. When zoomed in, tap
  the hand and drag the table, or hold Space and drag with the mouse.
- The centred player panels show the assigned groups and a stack of numbered balls.
  Pocketed balls are bright; balls still on the table appear faint. Ball in hand and
  the winning player also have explicit banners.

## Languages

Choose **English** or **Suomi** above the game modes. The browser remembers your choice.
English is the source language. To add another language, add a JSON catalog alongside
`src/locales/fi.json` and register it in `src/i18n.ts` with the language's own name.
The catalog uses the English text in `index.html` and in calls to `t()` as its keys.
Keep placeholders such as `{city}` in the translated sentence and use explicit option
values for settings. Missing translations fall back to English.

## Profiles and online play

Open **Profile** to set your name, see your player ID and QR code, and accept invites.
The opponent opens the same game server and scans the QR, reads a QR photo, or enters
the ID. A phone's normal camera can also open the invite link. Both players must use
the same reachable server; use a network hostname/address rather than `localhost`
for another device. Camera scanning requires HTTPS or localhost; photo/ID entry works
when camera access is unavailable.

Player identities are stored in this browser. A private random token establishes the
public player ID; the invite exposes only the public ID. Clearing browser storage changes
the identity. The host runs the match simulation and the guest submits validated inputs.
Disconnects pause play. Reconnecting restores the last server snapshot for up to ten
minutes while the same server process stays running. A server restart clears online
rooms; local game snapshots remain in the browser. This is casual multiplayer, not an
anti-cheat or account system.

Online turns have a server-managed 30-second shot clock. Time pauses during the stroke,
ball motion and disconnects, and starts again when the table is ready. Timing out passes
the turn and gives the opponent ball in hand. Practice and computer games have no clock.

## Checks

`npm test` covers collisions, friction/spin, shot power, pocket approaches, containment,
rules, saved-state validation, cue clearance, aiming guides, QR decoding and two-client
online reconnection. `npm run build` includes TypeScript checking. Visual and touch/camera
review is manual.

## Audio

Pool impacts use clips from SoundBible's public-domain [Playing Pool recording](https://soundbible.com/2035-Playing-Pool.html),
trimmed into cue, ball, rail and pocket effects. A synthesized fallback is used if the
recording cannot be loaded.
