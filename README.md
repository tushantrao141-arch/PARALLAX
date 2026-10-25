# PARALLAX — One of Your Screens Is Lying

A live, mobile-friendly social-deduction mystery game for 3–10 players. Everyone receives private evidence, but one player — the **Glitch** — sees a believable false reality.

## Current playable loop

1. A host creates a five-character room code and shares it.
2. Players join from individual devices without accounts.
3. The server secretly assigns one Glitch and distributes private evidence.
4. Players have 90 seconds to debate and independently order the five events.
5. The room shifts into a 30-second private vote.
6. The true sequence and Glitch are revealed, then the host can start another round.

The **Launch a demo table** button adds five simulated players so a single person can test the full interface and game progression.

## Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:3100` **while the terminal remains open**. On Windows you can also double-click `start-parallax.cmd`; it opens the persistent local server window for you. To play with nearby friends, use the computer's network address instead of localhost. If 3100 is busy, the terminal will show the next local URL automatically. For a public game link, deploy this Node server to a host that supports WebSockets (for example Render, Railway, Fly.io, or a Node-capable Vercel setup).

## Deploy on Render

This project includes `render.yaml`, which tells Render to build it with `npm ci` and run it using `npm start`.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/tushantrao141-arch/PARALLAX)

1. Push this project to a GitHub repository.
2. In Render, choose **New +** → **Blueprint**, then select that repository.
3. Confirm the detected `parallax-social-deduction` web service and click **Apply**.
4. After the deployment is live, share Render's `https://…onrender.com` URL with players.

Render provides the `PORT` environment variable automatically; PARALLAX reads it at startup and Socket.IO runs on the same public URL.

## Design decisions made for the first version

- **One crystal-clear case:** The 9:17 Vanishing has a five-event solution, keeping a new group's first round comprehensible.
- **Every device matters:** Evidence and role are private; the shared verbal discussion is the core interaction.
- **Low friction:** no account, a short room code, and an obvious demo route.
- **Easy to extend:** cases and clue sets are contained in `server.js`, ready to become a small mystery-content library.

## Next production increments

- Multiple authored cases and a difficulty selector.
- Persistent player reconnect tokens and a more robust room lifecycle.
- A proper host settings screen for round duration and Glitch abilities.
- Progressive “timeline echo” rules that only unlock after standard mode is learned.
- Deploy configuration, analytics, sound design, and an accessibility pass.
