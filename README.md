# 🎮 NexusCore — Gaming Tracker

A neon-themed gaming tracker that actually works. Track games in your vault, wishlist upcoming releases, watch live Twitch streams, and get AI-picked recommendations — all from a single static site you can host on GitHub Pages for free.

## ✨ Features

- **Real game data** — 800K+ games via RAWG API (covers, ratings, Metacritic, screenshots, platforms, genres)
- **Live streams** — Real Twitch streams keyed to the game you're viewing (not a hardcoded YouTube video!)
- **AI assistant** — NexusAI chatbot with curated fallback so it never silently breaks
- **Live deal tracking** — Real prices across stores via CheapShark
- **Steam library import** — paste your SteamID64 and your owned games show up in your vault
- **Personal tracking** — status (Backlog / Playing / Played / Dropped), 1–10 rating, free-text notes per game
- **Bulk import** — paste a list of titles and we resolve them via RAWG
- **Persistent** — everything saves to `localStorage`, survives reloads
- **Mobile-first** — designed for phones, works on desktop
- **No build step** — pure static files, deploy with one click to GitHub Pages

## 🚀 Run it locally

Just open `index.html` in a browser. That's it.

Or serve it:

```bash
cd gaming-tracker
python3 -m http.server 8000
# then open http://localhost:8000
```

## 🌐 Deploy to GitHub Pages

1. Push this folder to a GitHub repo
2. Settings → Pages → Source: `main` branch, root
3. Your site is live at `https://<user>.github.io/<repo>/`

The Twitch embed requires the site to be served over HTTPS or localhost with the `parent` param matching the host. `api.js` already uses `window.location.hostname` automatically.

## 🔑 API keys (already wired up)

| Service | What it does | Auth |
| --- | --- | --- |
| RAWG | Game catalog (the backbone) | Key in `api.js` |
| Twitch Helix | Real live streams + chat | OAuth client-credentials (auto) |
| CheapShark | Prices and deals | None |
| Pollinations AI | Free LLM for the assistant | None |
| Steam Web API | Import your library | Public profile only |

The Twitch and RAWG keys are committed to the repo. If you want to swap in your own:

- **RAWG** — get a free key at [rawg.io/apidocs](https://rawg.io/apidocs), replace `RAWG_KEY` in `api.js`
- **Twitch** — register an app at [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps), set the OAuth redirect to `http://localhost`, replace `TW_CLIENT` and `TW_SECRET` in `api.js`

> **Note on secrets in the browser:** Twitch's `client_credentials` flow uses a *client secret*, which Twitch normally requires to be kept private. The site uses it for **searching public stream metadata** (not user data) so the security risk is low, but if you fork this for a high-traffic project, proxy the Twitch call through a tiny serverless function.

## 🗂 File layout

```
gaming-tracker/
├── index.html       # the page shell, < 1KB
├── styles.css       # neon glass theme, no framework
├── icons.js         # inline SVG icon set
├── api.js           # all data sources (RAWG, Twitch, CheapShark, Pollinations, Steam)
├── store.js         # localStorage layer (vault, ratings, status, notes, wishlist)
├── app.js           # UI, all views, rendering
└── README.md
```

## 🧠 How the AI fallback works

Pollinations' free text endpoint queues per IP and sometimes returns `429 Queue full`. The site:

1. Tries Pollinations first (real LLM, no auth)
2. On any failure (timeout, 429, parse error) returns a curated local recommendation
3. Tells the user which source responded in the UI

This way the AI feature **always** works for end users, even if the upstream is congested.

## 🐛 Troubleshooting

- **Streams panel is empty?** The game might not be in Twitch's catalog (very small/niche titles). The UI falls back to currently-top streams automatically.
- **AI says "curated fallback"?** Pollinations is rate-limited from your IP. The fallback still gives a useful answer. To use a different LLM, edit `askAI` in `api.js`.
- **Steam import returns nothing?** Your profile must be set to Public in Steam → Edit Profile → Privacy Settings.
- **Vault disappeared?** Check that your browser allows `localStorage` for the site origin. (Incognito windows reset on close — that's expected.)

## 📜 License

MIT — fork it, ship it, have fun.
