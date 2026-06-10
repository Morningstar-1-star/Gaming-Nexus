// =========================================================================
// api.js — all data sources. Fixed game variety by rotating queries.
// =========================================================================

const RAWG_KEY    = '2d783ae8db664cc6a701077e074fcaf6';
const TW_CLIENT   = 'ua11i221wf7zwo5flk0u3dw1xryaoz';
const TW_SECRET   = 'oydoikkpvr8s4xmghip3yzpvwyu7ky';
const RAWG        = 'https://api.rawg.io/api';
const CHEAPSHARK  = 'https://www.cheapshark.com/api/1.0';
const TWITCH_OAUTH = 'https://id.twitch.tv/oauth2/token';
const TWITCH_HELIX = 'https://api.twitch.tv/helix';
const POLLINATIONS = 'https://text.pollinations.ai';

// short-lived in-memory cache so repeated tab switches don't re-fetch
const cache = new Map();
const inflight = new Map();
const CACHE_TTL = 1000 * 60 * 3; // 3 min — shorter so refresh gives new results

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
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
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
// RAWG — VARIETY FIX: rotate page + use multiple orderings
// ===========================================================================

// Each call picks a random page (1–4) so you see different games on refresh
function randPage(max = 4) {
  return Math.floor(Math.random() * max) + 1;
}

// Rotating orderings for trending so it's never the same list
const TRENDING_ORDERINGS = ['-added', '-released', '-updated', '-rating'];
const TOP_ORDERINGS      = ['-rating', '-metacritic', '-ratings_count'];

export async function trendingGames() {
  const ordering = TRENDING_ORDERINGS[Math.floor(Math.random() * TRENDING_ORDERINGS.length)];
  const page = randPage(5);
  // Don't cache with a fixed key — use timestamp bucket so same session stays stable but new sessions differ
  const bucket = Math.floor(Date.now() / (1000 * 60 * 3)); // changes every 3 min
  const d = await jget(
    `${RAWG}/games?key=${RAWG_KEY}&ordering=${ordering}&page_size=20&page=${page}`,
    {},
    `trending:${ordering}:${page}:${bucket}`
  );
  return (d.results || []).filter(g => g.background_image);
}

export async function topGames() {
  const ordering = TOP_ORDERINGS[Math.floor(Math.random() * TOP_ORDERINGS.length)];
  const page = randPage(3);
  const bucket = Math.floor(Date.now() / (1000 * 60 * 3));
  const d = await jget(
    `${RAWG}/games?key=${RAWG_KEY}&ordering=${ordering}&page_size=20&page=${page}&metacritic=70,100`,
    {},
    `top:${ordering}:${page}:${bucket}`
  );
  return (d.results || []).filter(g => g.background_image);
}

export async function upcomingGames() {
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(Date.now() + 365 * 24 * 3600e3).toISOString().slice(0, 10);
  const page = randPage(3);
  const bucket = Math.floor(Date.now() / (1000 * 60 * 3));
  const d = await jget(
    `${RAWG}/games?key=${RAWG_KEY}&dates=${today},${future}&ordering=-added&page_size=15&page=${page}`,
    {},
    `upcoming:${page}:${bucket}`
  );
  return (d.results || []).filter(g => g.background_image);
}

export async function browseGames({ genre = '', platform = '', ordering = '-rating', page = 1 } = {}) {
  const params = new URLSearchParams({ key: RAWG_KEY, page_size: '20', ordering, page: String(page) });
  if (genre)    params.set('genres',    genre.toLowerCase());
  if (platform) params.set('platforms', platform);
  const d = await jget(`${RAWG}/games?${params}`);
  return (d.results || []).filter(g => g.background_image);
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
// CheapShark — deals
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

// ===========================================================================
// Twitch
// ===========================================================================
let _twToken = null;
let _twTokenExp = 0;

async function getTwitchToken() {
  if (_twToken && Date.now() < _twTokenExp - 60_000) return _twToken;
  const body = new URLSearchParams({ client_id: TW_CLIENT, client_secret: TW_SECRET, grant_type: 'client_credentials' });
  const r = await fetch(TWITCH_OAUTH, { method: 'POST', body });
  if (!r.ok) throw new Error(`Twitch auth ${r.status}`);
  const j = await r.json();
  _twToken = j.access_token;
  _twTokenExp = Date.now() + (j.expires_in * 1000);
  return _twToken;
}

export async function twitchGameId(name) {
  if (!name) return null;
  const token = await getTwitchToken();
  const d = await jget(
    `${TWITCH_HELIX}/games?name=${encodeURIComponent(name)}`,
    { headers: { 'Client-ID': TW_CLIENT, 'Authorization': `Bearer ${token}` } },
    `tw:game:${name}`
  );
  return d.data?.[0]?.id || null;
}

export async function liveStreamsForGame(name, limit = 8) {
  try {
    const token = await getTwitchToken();
    const gameId = await twitchGameId(name);
    if (!gameId) {
      const d = await jget(
        `${TWITCH_HELIX}/streams?first=${limit}&language=en`,
        { headers: { 'Client-ID': TW_CLIENT, 'Authorization': `Bearer ${token}` } },
        'tw:streams:fallback'
      );
      return d.data || [];
    }
    const d = await jget(
      `${TWITCH_HELIX}/streams?game_id=${gameId}&first=${limit}&language=en`,
      { headers: { 'Client-ID': TW_CLIENT, 'Authorization': `Bearer ${token}` } },
      `tw:streams:${gameId}`
    );
    return d.data || [];
  } catch { return []; }
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
  } catch { return []; }
}

export function twitchEmbedUrl(channel, parent = window.location.hostname || 'localhost') {
  return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(parent)}&muted=true`;
}

// ===========================================================================
// Steam
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
  } catch { return []; }
}

// ===========================================================================
// AI — Pollinations free LLM
// ===========================================================================
const LOCAL_FALLBACK = [
  (q) => `For "${q}": Elden Ring (open-world masterpiece), Hollow Knight (best indie metroidvania), Hades (perfect roguelike), or Baldur's Gate 3 for deep story.`,
  (q) => `On "${q}": short sessions → Vampire Survivors or Hades. Long sessions → The Witcher 3 or Persona 5. Co-op → It Takes Two.`,
  (q) => `"${q}" shortlist: Zelda TotK, RE4 Remake, Cyberpunk 2.0, or Disco Elysium if you like words over guns.`,
];

export async function askAI(prompt) {
  try {
    const url = `${POLLINATIONS}/${encodeURIComponent(prompt)}?model=openai-fast&seed=${Math.floor(Math.random() * 1e6)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(18_000) });
    if (r.ok) {
      const text = (await r.text()).trim();
      if (text && text.length > 5 && !text.toLowerCase().includes('queue full')) {
        return { text, source: 'pollinations' };
      }
    }
  } catch {}
  const tpl = LOCAL_FALLBACK[Math.floor(Math.random() * LOCAL_FALLBACK.length)];
  return { text: tpl(prompt), source: 'local' };
}

export function safeImage(url, fallback = '') {
  return url || fallback;
}
