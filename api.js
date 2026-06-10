// =========================================================================
// api.js — all data sources, no UI. Every function is async and resolves
// to plain objects the UI can render. Caches live in module scope so we
// don't hammer endpoints. localStorage layer lives in store.js.
// =========================================================================

// -- CONFIG (keys the user provided) -----------------------------------------
const RAWG_KEY    = '2d783ae8db664cc6a701077e074fcaf6';
const TW_CLIENT   = 'ua11i221wf7zwo5flk0u3dw1xryaoz';
const TW_SECRET   = 'oydoikkpvr8s4xmghip3yzpvwyu7ky';
const RAWG        = 'https://api.rawg.io/api';
const CHEAPSHARK  = 'https://www.cheapshark.com/api/1.0';
const TWITCH_OAUTH = 'https://id.twitch.tv/oauth2/token';
const TWITCH_HELIX = 'https://api.twitch.tv/helix';
const POLLINATIONS = 'https://text.pollinations.ai';

// -- in-memory cache + tiny request deduper --------------------------------
const cache = new Map();            // key -> { t, v }   (t = timestamp, ms)
const inflight = new Map();         // key -> Promise    (dedupe parallel calls)
const CACHE_TTL = 1000 * 60 * 5;    // 5 minutes

function cacheGet(k) {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.t > CACHE_TTL) { cache.delete(k); return null; }
  return e.v;
}
function cacheSet(k, v) { cache.set(k, { t: Date.now(), v }); }

async function jget(url, opts = {}, cacheKey = url) {
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  if (inflight.has(cacheKey)) return inflight.get(cacheKey);

  const p = (async () => {
    try {
      const r = await fetch(url, opts);
      if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
      const data = await r.json();
      cacheSet(cacheKey, data);
      return data;
    } finally {
      inflight.delete(cacheKey);
    }
  })();
  inflight.set(cacheKey, p);
  return p;
}

// ===========================================================================
// RAWG — game catalog, screenshots, metadata
// ===========================================================================
export async function trendingGames() {
  const d = await jget(`${RAWG}/games?key=${RAWG_KEY}&ordering=-added&page_size=15`);
  return d.results || [];
}
export async function topGames() {
  const d = await jget(`${RAWG}/games?key=${RAWG_KEY}&ordering=-rating&page_size=20&metacritic=80,100`);
  return d.results || [];
}
export async function upcomingGames() {
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(Date.now() + 365 * 24 * 3600e3).toISOString().slice(0, 10);
  const d = await jget(`${RAWG}/games?key=${RAWG_KEY}&dates=${today},${future}&ordering=-added&page_size=15`);
  return d.results || [];
}
export async function browseGames({ genre = '', platform = '', ordering = '-rating', page = 1 } = {}) {
  const params = new URLSearchParams({ key: RAWG_KEY, page_size: '20', ordering, page: String(page) });
  if (genre)    params.set('genres',    genre.toLowerCase());
  if (platform) params.set('platforms', platform);
  const d = await jget(`${RAWG}/games?${params}`);
  return d.results || [];
}
export async function searchGames(q) {
  if (!q.trim()) return [];
  const d = await jget(`${RAWG}/games?key=${RAWG_KEY}&search=${encodeURIComponent(q)}&page_size=20`);
  return d.results || [];
}
export async function gameDetails(id) {
  return jget(`${RAWG}/games/${id}?key=${RAWG_KEY}`, {}, `game:${id}`);
}
export async function gameScreenshots(id) {
  const d = await jget(`${RAWG}/games/${id}/screenshots?key=${RAWG_KEY}`, {}, `ss:${id}`);
  return d.results || [];
}

// ===========================================================================
// CheapShark — real prices, deals, stores (no key)
// ===========================================================================
export async function topDeals() {
  return jget(`${CHEAPSHARK}/deals?pageSize=20&sortBy=Savings`, {}, 'cs:top');
}
export async function lookupGame(title) {
  if (!title) return [];
  return jget(`${CHEAPSHARK}/games?title=${encodeURIComponent(title)}`, {}, `cs:lu:${title}`);
}
export async function gameDeals(cheapsharkId) {
  return jget(`${CHEAPSHARK}/games?id=${cheapsharkId}`, {}, `cs:gd:${cheapsharkId}`);
}
export async function stores() {
  return jget(`${CHEAPSHARK}/stores`, {}, 'cs:stores');
}

// ===========================================================================
// Twitch — real live streams keyed to the actual game
// ===========================================================================
let _twToken = null;
let _twTokenExp = 0;

async function getTwitchToken() {
  if (_twToken && Date.now() < _twTokenExp - 60_000) return _twToken;
  const body = new URLSearchParams({
    client_id: TW_CLIENT,
    client_secret: TW_SECRET,
    grant_type: 'client_credentials',
  });
  const r = await fetch(TWITCH_OAUTH, { method: 'POST', body });
  if (!r.ok) throw new Error(`Twitch auth failed: ${r.status}`);
  const j = await r.json();
  _twToken = j.access_token;
  _twTokenExp = Date.now() + (j.expires_in * 1000);
  return _twToken;
}

export async function twitchGameId(name) {
  if (!name) return null;
  const token = await getTwitchToken();
  const url = `${TWITCH_HELIX}/games?name=${encodeURIComponent(name)}`;
  const d = await jget(url, { headers: { 'Client-ID': TW_CLIENT, 'Authorization': `Bearer ${token}` } }, `tw:game:${name}`);
  return d.data?.[0]?.id || null;
}

export async function liveStreamsForGame(name, limit = 8) {
  try {
    const token = await getTwitchToken();
    let gameId = await twitchGameId(name);
    if (!gameId) {
      // try a less-strict fallback: broad streams list
      const d = await jget(
        `${TWITCH_HELIX}/streams?first=${limit}&language=en`,
        { headers: { 'Client-ID': TW_CLIENT, 'Authorization': `Bearer ${token}` } },
        'tw:streams:fallback'
      );
      return (d.data || []).map(s => ({ ...s, game_name_guess: s.game_name }));
    }
    const d = await jget(
      `${TWITCH_HELIX}/streams?game_id=${gameId}&first=${limit}&language=en`,
      { headers: { 'Client-ID': TW_CLIENT, 'Authorization': `Bearer ${token}` } },
      `tw:streams:${gameId}`
    );
    return d.data || [];
  } catch (e) {
    console.warn('twitch streams failed:', e);
    return [];
  }
}

export async function liveStreamsFeatured(limit = 10) {
  try {
    const token = await getTwitchToken();
    const d = await jget(
      `${TWITCH_HELIX}/streams?first=${limit}&language=en`,
      { headers: { 'Client-ID': TW_CLIENT, 'Authorization': `Bearer ${token}` } },
      'tw:streams:featured'
    );
    return d.data || [];
  } catch (e) {
    return [];
  }
}

// Twitch embed URL — no auth required, parent = current origin
export function twitchEmbedUrl(channel, parent = window.location.hostname || 'localhost') {
  return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(parent)}&muted=true`;
}

// ===========================================================================
// Steam — real public library (no key needed, profile must be public)
// ===========================================================================
export async function steamLibrary(steamId) {
  if (!steamId) return [];
  try {
    const r = await fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`);
    if (!r.ok) throw new Error('steam ' + r.status);
    const j = await r.json();
    return (j.response?.games || []).map(g => ({
      id: `steam-${g.appid}`,
      steamAppId: g.appid,
      name: g.name,
      background_image: `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/library_600x900_2x.jpg`,
      header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
      playtime: g.playtime_forever,
      source: 'steam',
      rating: 0,
    }));
  } catch (e) {
    console.warn('steam failed:', e);
    return [];
  }
}

// CheapShark price for a Steam app
export async function steamDeals(appId) {
  return jget(`${CHEAPSHARK}/games?steamAppID=${appId}`, {}, `cs:sa:${appId}`);
}

// ===========================================================================
// AI — Pollinations (free, no key) with smart local fallback
// ===========================================================================
const LOCAL_FALLBACK_TEMPLATES = [
  (q) => `Based on your query "${q}", here are some solid picks: Elden Ring (masterclass open-world RPG), Hollow Knight (best indie metroidvania), Hades (perfect roguelike for short sessions), or Baldur's Gate 3 if you want a deep story.`,
  (q) => `Quick take on "${q}": if you have ~10 hours, try Inscryption. For 30+, it's Persona 5 Royal or The Witcher 3. For a quick hit, Vampire Survivors. Want co-op? It Takes Two.`,
  (q) => `For "${q}", the shortlist I'd give a friend: Zelda: TotK, RE4 Remake, Cyberpunk 2077 (post-2.0), or Disco Elysium if you like words > guns.`,
];

export async function askAI(prompt) {
  // 1) try Pollinations (real LLM, free, no key)
  try {
    const url = `${POLLINATIONS}/${encodeURIComponent(prompt)}?model=openai-fast&seed=${Math.floor(Math.random() * 1e6)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (r.ok) {
      const text = (await r.text()).trim();
      if (text && text.length > 5 && !text.toLowerCase().includes('queue full')) {
        return { text, source: 'pollinations' };
      }
    }
  } catch (e) { /* fall through */ }

  // 2) local curated fallback
  const tpl = LOCAL_FALLBACK_TEMPLATES[Math.floor(Math.random() * LOCAL_FALLBACK_TEMPLATES.length)];
  return { text: tpl(prompt), source: 'local' };
}

// ===========================================================================
// Image helpers
// ===========================================================================
export function safeImage(url, fallback = '') {
  if (!url) return fallback;
  // RAWG images work fine; same-origin-friendly
  return url;
}
