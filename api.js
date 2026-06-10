// =========================================================================
// api.js — fixed variety: genre shelves, new releases, upcoming
// =========================================================================

const RAWG_KEY    = '2d783ae8db664cc6a701077e074fcaf6';
const TW_CLIENT   = 'ua11i221wf7zwo5flk0u3dw1xryaoz';
const TW_SECRET   = 'oydoikkpvr8s4xmghip3yzpvwyu7ky';
const RAWG        = 'https://api.rawg.io/api';
const CHEAPSHARK  = 'https://www.cheapshark.com/api/1.0';
const TWITCH_OAUTH = 'https://id.twitch.tv/oauth2/token';
const TWITCH_HELIX = 'https://api.twitch.tv/helix';
const POLLINATIONS = 'https://text.pollinations.ai';

// Per-session cache (clears on reload = fresh games every visit)
const cache = new Map();
const inflight = new Map();
const CACHE_TTL = 1000 * 60 * 5;

function cacheGet(k) {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.t > CACHE_TTL) { cache.delete(k); return null; }
  return e.v;
}
function cacheSet(k, v) { cache.set(k, { t: Date.now(), v }); }

async function jget(url, opts = {}, key = url) {
  const hit = cacheGet(key);
  if (hit) return hit;
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const r = await fetch(url, opts);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      cacheSet(key, d);
      return d;
    } finally { inflight.delete(key); }
  })();
  inflight.set(key, p);
  return p;
}

// Random page so every reload = different games
function rp(max = 5) { return Math.floor(Math.random() * max) + 1; }

// Date helpers
function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) { return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }
function daysAhead(n) { return new Date(Date.now() + n * 864e5).toISOString().slice(0, 10); }

// ===========================================================================
// HOME SHELVES — each fetches a distinct, specific category
// ===========================================================================

// 1. New releases — games released in last 60 days, sorted by rating
export async function newReleases() {
  const p = rp(3);
  const d = await jget(
    `${RAWG}/games?key=${RAWG_KEY}&dates=${daysAgo(60)},${today()}&ordering=-rating&page_size=20&page=${p}`,
    {}, `new:${p}`
  );
  return (d.results || []).filter(g => g.background_image);
}

// 2. Upcoming — next 180 days
export async function upcomingGames() {
  const p = rp(3);
  const d = await jget(
    `${RAWG}/games?key=${RAWG_KEY}&dates=${today()},${daysAhead(180)}&ordering=-added&page_size=20&page=${p}`,
    {}, `upcoming:${p}`
  );
  return (d.results || []).filter(g => g.background_image);
}

// 3. Trending — popular in last 30 days by added count
export async function trendingGames() {
  const p = rp(4);
  const d = await jget(
    `${RAWG}/games?key=${RAWG_KEY}&dates=${daysAgo(30)},${today()}&ordering=-added&page_size=20&page=${p}`,
    {}, `trend:${p}`
  );
  return (d.results || []).filter(g => g.background_image);
}

// 4. Top rated all time (for rankings page)
export async function topGames() {
  const p = rp(3);
  const d = await jget(
    `${RAWG}/games?key=${RAWG_KEY}&ordering=-rating&page_size=20&page=${p}&metacritic=70,100`,
    {}, `top:${p}`
  );
  return (d.results || []).filter(g => g.background_image);
}

// 5. Genre-specific shelf — key param is RAWG genre slug
export async function genreGames(slug) {
  const p = rp(4);
  const d = await jget(
    `${RAWG}/games?key=${RAWG_KEY}&genres=${slug}&ordering=-rating&page_size=20&page=${p}`,
    {}, `genre:${slug}:${p}`
  );
  return (d.results || []).filter(g => g.background_image);
}

// 6. Browse (Explore page with filters)
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
  return jget(`${RAWG}/games/${id}?key=${RAWG_KEY}`, {}, `gd:${id}`);
}

export async function gameScreenshots(id) {
  const d = await jget(`${RAWG}/games/${id}/screenshots?key=${RAWG_KEY}`, {}, `ss:${id}`);
  return d.results || [];
}

// ===========================================================================
// CheapShark
// ===========================================================================
export async function topDeals() {
  return jget(`${CHEAPSHARK}/deals?pageSize=20&sortBy=Savings`, {}, 'cs:top');
}
export async function lookupGame(title) {
  if (!title) return [];
  return jget(`${CHEAPSHARK}/games?title=${encodeURIComponent(title)}`, {}, `cs:lu:${title}`);
}
export async function gameDeals(id) {
  return jget(`${CHEAPSHARK}/games?id=${id}`, {}, `cs:gd:${id}`);
}

// ===========================================================================
// Twitch
// ===========================================================================
let _twToken = null, _twExp = 0;
async function getTwitchToken() {
  if (_twToken && Date.now() < _twExp - 60000) return _twToken;
  const r = await fetch(TWITCH_OAUTH, {
    method: 'POST',
    body: new URLSearchParams({ client_id: TW_CLIENT, client_secret: TW_SECRET, grant_type: 'client_credentials' }),
  });
  if (!r.ok) throw new Error('Twitch auth ' + r.status);
  const j = await r.json();
  _twToken = j.access_token; _twExp = Date.now() + j.expires_in * 1000;
  return _twToken;
}
export async function liveStreamsForGame(name, limit = 8) {
  try {
    const token = await getTwitchToken();
    const gd = await jget(`${TWITCH_HELIX}/games?name=${encodeURIComponent(name)}`, { headers: { 'Client-ID': TW_CLIENT, 'Authorization': `Bearer ${token}` } }, `twg:${name}`);
    const gameId = gd.data?.[0]?.id;
    if (!gameId) return liveStreamsFeatured(limit);
    const d = await jget(`${TWITCH_HELIX}/streams?game_id=${gameId}&first=${limit}`, { headers: { 'Client-ID': TW_CLIENT, 'Authorization': `Bearer ${token}` } }, `tws:${gameId}`);
    return d.data || [];
  } catch { return []; }
}
export async function liveStreamsFeatured(limit = 10) {
  try {
    const token = await getTwitchToken();
    const d = await jget(`${TWITCH_HELIX}/streams?first=${limit}`, { headers: { 'Client-ID': TW_CLIENT, 'Authorization': `Bearer ${token}` } }, 'tws:feat');
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
      id: `steam-${g.appid}`, steamAppId: g.appid, name: g.name,
      background_image: `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/library_600x900_2x.jpg`,
      playtime: g.playtime_forever, source: 'steam', rating: 0,
    }));
  } catch { return []; }
}

// ===========================================================================
// AI
// ===========================================================================
export async function askAI(prompt) {
  try {
    const url = `${POLLINATIONS}/${encodeURIComponent(prompt)}?model=openai-fast&seed=${Math.floor(Math.random() * 1e6)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(18000) });
    if (r.ok) {
      const text = (await r.text()).trim();
      if (text && text.length > 5 && !text.toLowerCase().includes('queue full'))
        return { text, source: 'pollinations' };
    }
  } catch {}
  return { text: `For your query about "${prompt.slice(0, 40)}…": try Elden Ring, Hades, Hollow Knight, or Baldur's Gate 3.`, source: 'local' };
}

export function safeImage(url) { return url || ''; }
