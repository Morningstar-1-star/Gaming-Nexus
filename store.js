// =========================================================================
// store.js — localStorage persistence layer with proper schema
// =========================================================================
const KEY = 'gaming-tracker:v1';

const DEFAULT = {
  vault: [],          // [{ id, name, background_image, status, personalRating, notes, addedAt }]
  wishlist: [],       // same shape
  ratings: {},        // { gameId: { rating, notes } }
  status: {},         // { gameId: 'backlog' | 'playing' | 'played' | 'dropped' }
  deals: [],          // last fetched deals (cache)
  settings: {
    theme: 'dark',
    parent: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
  },
};

let state = load();
const subs = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT), ...parsed };
  } catch {
    return structuredClone(DEFAULT);
  }
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  subs.forEach(fn => { try { fn(state); } catch {} });
}

export function getState() { return state; }
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

// -- vault -----------------------------------------------------------------
export function inVault(id)    { return state.vault.some(g => g.id === id); }
export function addToVault(g)   {
  if (inVault(g.id)) return;
  state.vault.unshift({ ...g, addedAt: Date.now(), status: g.status || 'backlog' });
  persist();
}
export function removeFromVault(id) {
  state.vault = state.vault.filter(g => g.id !== id);
  delete state.status[id];
  delete state.ratings[id];
  persist();
}
export function setStatus(id, status) {
  if (state.vault.some(g => g.id === id)) {
    state.status[id] = status;
  } else {
    state.wishlist.some(g => g.id === id) || state.wishlist.unshift({ id, name: id, status, addedAt: Date.now() });
  }
  persist();
}
export function getStatus(id) { return state.status[id] || 'backlog'; }

// -- ratings + notes -------------------------------------------------------
export function setRating(id, rating) {
  state.ratings[id] = { ...(state.ratings[id] || {}), rating };
  persist();
}
export function setNotes(id, notes) {
  state.ratings[id] = { ...(state.ratings[id] || {}), notes };
  persist();
}
export function getEntry(id) { return state.ratings[id] || {}; }

// -- wishlist --------------------------------------------------------------
export function inWishlist(id) { return state.wishlist.some(g => g.id === id); }
export function toggleWishlist(g) {
  if (inWishlist(g.id)) state.wishlist = state.wishlist.filter(x => x.id !== g.id);
  else state.wishlist.unshift({ ...g, addedAt: Date.now() });
  persist();
}

// -- settings --------------------------------------------------------------
export function setSetting(k, v) { state.settings[k] = v; persist(); }
