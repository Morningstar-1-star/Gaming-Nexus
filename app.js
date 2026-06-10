// =========================================================================
// app.js — minimal redesign, same features
// =========================================================================
import * as API from './api.js';
import * as Store from './store.js';
import { I } from './icons.js';

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
const h = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el) { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
};

const vib = (ms = 20) => { try { navigator.vibrate?.(ms); } catch {} };

let toastTimer = null;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = h('div', { class: 'toast' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------
const state = {
  tab: 'home',
  games: { trending: [], upcoming: [], top: [] },
  loading: true,
  activeGame: null,
  mode: null,         // 'detail' | 'stream'
  showImport: false,
  showAI: false,
  showSteam: false,
  filters: { genre: '', platform: '' },
  search: { q: '', results: [], loading: false },
  bootDone: false,
  vaultFilter: 'all',
  rankingsTab: 'rating',
};

// ---------------------------------------------------------------------------
// render root
// ---------------------------------------------------------------------------
function render() {
  const root = document.getElementById('app');
  root.innerHTML = '';

  if (!state.bootDone) { root.append(renderBoot()); return; }

  if (state.activeGame && state.mode === 'detail') {
    root.append(renderGameDetail(state.activeGame));
  } else if (state.activeGame && state.mode === 'stream') {
    root.append(renderStreamModal(state.activeGame));
  } else {
    root.append(renderTab());
    root.append(renderNav());
  }

  if (state.showImport) root.append(renderImportModal());
  if (state.showAI)     root.append(renderAIModal());
  if (state.showSteam)  root.append(renderSteamModal());

  // floating AI fab (only on main tabs)
  const inModal = state.activeGame || state.showImport || state.showAI || state.showSteam;
  if (!inModal) {
    root.append(h('button', {
      class: 'tap',
      style: {
        position: 'fixed', bottom: '72px', right: '16px', zIndex: 40,
        width: '48px', height: '48px', borderRadius: '50%',
        background: 'var(--accent)',
        boxShadow: '0 4px 16px rgba(108,99,255,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      },
      onClick: () => { vib(30); state.showAI = true; render(); },
    }, I('bot', 20, { style: 'color:white' })));
  }
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
function renderBoot() {
  return h('div', { class: 'boot-screen' },
    h('div', { class: 'boot-icon' }, I('gamepad', 28, { style: 'color:white' })),
    h('div', { style: { textAlign: 'center' } },
      h('h1', { style: { fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' } }, 'NexusCore'),
      h('p', { style: { color: 'var(--muted)', fontSize: '12px', marginTop: '4px' } }, 'Gaming Tracker'),
    ),
    h('div', { class: 'boot-bar-track' }, h('div', { class: 'boot-bar-fill' })),
  );
}

// ---------------------------------------------------------------------------
// nav
// ---------------------------------------------------------------------------
function renderNav() {
  const NAV = [
    { id: 'home',     icon: 'home',    label: 'Home' },
    { id: 'explore',  icon: 'compass', label: 'Explore' },
    { id: 'search',   icon: 'search',  label: 'Search' },
    { id: 'rankings', icon: 'trending',label: 'Ranks' },
    { id: 'vault',    icon: 'library', label: 'Vault' },
    { id: 'profile',  icon: 'user',    label: 'Profile' },
  ];
  return h('nav', { class: 'bottom-nav' },
    ...NAV.map(item => {
      const active = state.tab === item.id;
      return h('button', {
        class: `nav-item tap${active ? ' active' : ''}`,
        onClick: () => { vib(15); state.tab = item.id; render(); },
      },
        I(item.icon, 20),
        h('span', null, item.label),
        h('div', { class: 'nav-dot' }),
      );
    }),
  );
}

// ---------------------------------------------------------------------------
// tab dispatcher
// ---------------------------------------------------------------------------
function renderTab() {
  switch (state.tab) {
    case 'home':     return renderHome();
    case 'explore':  return renderExplore();
    case 'search':   return renderSearch();
    case 'rankings': return renderRankings();
    case 'vault':    return renderVault();
    case 'profile':  return renderProfile();
    default:         return renderHome();
  }
}

// ===========================================================================
// HOME
// ===========================================================================
function renderHome() {
  const wrap = h('div', { class: 'fade-up', style: { paddingBottom: '80px' } });

  if (state.loading) {
    wrap.append(
      h('div', { style: { padding: '16px', marginTop: '16px' } },
        h('div', { class: 'skeleton', style: { height: '220px', borderRadius: '20px', marginBottom: '24px' } }),
        h('div', { class: 'skeleton', style: { height: '14px', width: '120px', marginBottom: '12px', marginLeft: '16px' } }),
        h('div', { style: { display: 'flex', gap: '12px', padding: '0 16px', overflowX: 'hidden' } },
          ...[0,1,2].map(() => h('div', { class: 'skeleton', style: { minWidth: '140px', height: '110px', borderRadius: '12px', flexShrink: 0 } }))
        )
      )
    );
    return wrap;
  }

  const trending = state.games.trending;
  const upcoming = state.games.upcoming;
  const top = state.games.top;

  // header
  wrap.append(h('div', { style: { padding: '56px 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
    h('div', null,
      h('p', { style: { color: 'var(--muted)', fontSize: '13px' } }, 'Good to see you'),
      h('h1', { style: { fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', marginTop: '2px' } }, 'What to play?'),
    ),
    h('button', {
      class: 'tap',
      style: { width: '40px', height: '40px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      onClick: () => { vib(); state.showSteam = true; render(); },
    }, I('gamepad', 18, { style: 'color:var(--muted)' })),
  ));

  // hero carousel
  if (trending.length) {
    const carousel = h('div', {
      class: 'snap-x hide-scroll',
      style: { display: 'flex', gap: '12px', padding: '0 16px', overflowX: 'auto' },
    });
    trending.slice(0, 6).forEach(game => {
      const card = h('div', {
        class: 'hero-card snap-start tap no-select',
        style: { minWidth: '75vw', maxWidth: '320px', flexShrink: 0 },
        onClick: () => { vib(30); state.activeGame = game; state.mode = 'detail'; render(); },
      },
        h('img', { src: game.background_image, loading: 'lazy', onError: (e) => { e.target.style.opacity = '0.3'; } }),
        h('div', { class: 'hero-gradient' }),
        h('div', { class: 'hero-meta' },
          h('p', { class: 'line-clamp-1', style: { fontSize: '15px', fontWeight: 700, marginBottom: '2px' } }, game.name),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            game.rating ? h('span', { style: { fontSize: '12px', color: 'var(--gold)', fontWeight: 600 } }, `★ ${game.rating.toFixed(1)}`) : null,
            game.genres?.[0] ? h('span', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.5)' } }, game.genres[0].name) : null,
          ),
          h('div', { style: { display: 'flex', gap: '8px', marginTop: '10px' } },
            h('button', {
              class: 'tap',
              style: { flex: 1, background: 'white', color: '#000', fontWeight: 700, fontSize: '12px', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
              onClick: (e) => { e.stopPropagation(); vib(30); state.activeGame = game; state.mode = 'stream'; render(); },
            }, I('play', 13, { style: 'color:#000' }), 'Watch'),
            h('button', {
              class: 'tap',
              style: { padding: '8px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', fontSize: '12px', fontWeight: 600, color: 'white' },
              onClick: (e) => {
                e.stopPropagation(); vib(20);
                if (Store.inVault(game.id)) Store.removeFromVault(game.id);
                else Store.addToVault(game);
                toast(Store.inVault(game.id) ? 'Added to vault' : 'Removed');
                render();
              },
            }, Store.inVault(game.id) ? '✓ Saved' : '+ Save'),
          ),
        ),
      );
      carousel.append(card);
    });
    wrap.append(carousel);
  }

  wrap.append(renderShelf('Trending', trending, 'flame', 'var(--accent)'));
  wrap.append(renderShelf('Coming Soon', upcoming, 'clock', 'var(--gold)'));
  wrap.append(renderShelf('Top Rated', top, 'trophy', 'var(--green)', true));

  return wrap;
}

function renderShelf(title, data, icon, color, ranked = false) {
  const section = h('div', { style: { marginTop: '28px' } });
  section.append(h('div', { class: 'section-header' },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      I(icon, 16, { style: `color:${color}` }),
      h('span', { class: 'section-title' }, title),
    ),
    h('span', { style: { fontSize: '12px', color: 'var(--muted)' } }, `${data.length}`),
  ));

  const row = h('div', { class: 'hide-scroll snap-x', style: { display: 'flex', gap: '10px', padding: '0 16px', overflowX: 'auto' } });
  (data.length ? data : []).forEach((g, i) => row.append(renderSmallCard(g, ranked ? i + 1 : null)));
  section.append(row);
  return section;
}

function renderSmallCard(game, rank = null) {
  return h('div', {
    class: 'tap snap-start no-select',
    style: { minWidth: '130px', width: '130px', cursor: 'pointer' },
    onClick: () => { vib(20); state.activeGame = game; state.mode = 'detail'; render(); },
  },
    h('div', { class: 'game-card-thumb', style: { borderRadius: '12px', marginBottom: '8px', height: '90px' } },
      game.background_image
        ? h('img', { src: game.background_image, loading: 'lazy', onError: (e) => { e.target.style.opacity = '0.2'; } })
        : h('div', { class: 'skeleton', style: { width: '100%', height: '100%' } }),
      rank ? h('div', {
        style: {
          position: 'absolute', top: '6px', left: '6px',
          width: '22px', height: '22px', borderRadius: '6px',
          background: rank <= 3 ? 'var(--gold)' : 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 800, color: rank <= 3 ? '#000' : 'white',
        },
      }, String(rank)) : null,
      game.rating ? h('div', {
        style: { position: 'absolute', bottom: '5px', right: '6px', background: 'rgba(0,0,0,0.75)', borderRadius: '5px', padding: '2px 6px', fontSize: '10px', fontWeight: 700, color: 'var(--gold)' },
      }, `★ ${game.rating.toFixed(1)}`) : null,
    ),
    h('p', { class: 'line-clamp-1', style: { fontSize: '12px', fontWeight: 600, marginBottom: '2px' } }, game.name),
    h('p', { style: { fontSize: '10px', color: 'var(--muted)' } }, game.genres?.[0]?.name || ''),
  );
}

// ===========================================================================
// EXPLORE
// ===========================================================================
function renderExplore() {
  const wrap = h('div', { class: 'fade-up', style: { paddingBottom: '80px', minHeight: '100vh' } });
  wrap.append(h('div', { class: 'page-header' },
    h('h1', { class: 'page-title' }, 'Explore'),
    h('p', { class: 'page-sub' }, 'Filter by platform or genre'),
  ));

  const PLATFORMS = [
    { id: '', label: 'All' }, { id: '4', label: 'PC' }, { id: '187', label: 'PS5' },
    { id: '1', label: 'Xbox' }, { id: '7', label: 'Switch' }, { id: '3', label: 'iOS' },
  ];
  const GENRES = ['Action', 'RPG', 'Shooter', 'Strategy', 'Horror', 'Indie', 'Sports', 'Racing', 'Adventure', 'Simulation', 'Puzzle', 'Platformer'];

  wrap.append(h('div', { class: 'hide-scroll', style: { display: 'flex', gap: '8px', padding: '0 16px 8px', overflowX: 'auto' } },
    ...PLATFORMS.map(p => pill(p.label, state.filters.platform === p.id, () => { vib(); state.filters.platform = p.id; refreshExplore(); })),
  ));
  wrap.append(h('div', { class: 'hide-scroll', style: { display: 'flex', gap: '8px', padding: '0 16px 16px', overflowX: 'auto' } },
    pill('All', !state.filters.genre, () => { vib(); state.filters.genre = ''; refreshExplore(); }),
    ...GENRES.map(g => pill(g, state.filters.genre === g, () => { vib(); state.filters.genre = g; refreshExplore(); })),
  ));

  const grid = h('div', { id: 'explore-grid', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '0 16px' } });
  wrap.append(grid);
  refreshExplore(true);
  return wrap;
}

async function refreshExplore(initial = false) {
  const grid = document.getElementById('explore-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    grid.append(h('div', { class: 'game-card' },
      h('div', { class: 'skeleton', style: { aspectRatio: '16/9' } }),
      h('div', { style: { padding: '10px' } },
        h('div', { class: 'skeleton', style: { height: '12px', marginBottom: '6px' } }),
        h('div', { class: 'skeleton', style: { height: '10px', width: '50%' } }),
      )
    ));
  }
  try {
    const results = await API.browseGames({ genre: state.filters.genre, platform: state.filters.platform });
    grid.innerHTML = '';
    if (!results.length) {
      grid.append(h('p', { style: { gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '14px' } }, 'No games found. Try different filters.'));
      return;
    }
    results.forEach((g, i) => {
      grid.append(h('div', {
        class: 'game-card tap',
        style: { animation: `fadeUp 0.3s ${i * 25}ms ease backwards`, cursor: 'pointer' },
        onClick: () => { vib(20); state.activeGame = g; state.mode = 'detail'; render(); },
      },
        h('div', { class: 'game-card-thumb' },
          g.background_image ? h('img', { src: g.background_image, loading: 'lazy' }) : null,
          g.rating ? h('div', { style: { position: 'absolute', bottom: '5px', right: '6px', background: 'rgba(0,0,0,0.8)', borderRadius: '5px', padding: '2px 6px', fontSize: '10px', fontWeight: 700, color: 'var(--gold)' } }, `★ ${g.rating.toFixed(1)}`) : null,
        ),
        h('div', { style: { padding: '10px' } },
          h('p', { class: 'line-clamp-1', style: { fontSize: '13px', fontWeight: 600, marginBottom: '2px' } }, g.name),
          h('p', { style: { fontSize: '10px', color: 'var(--muted)' } }, g.genres?.[0]?.name || '—'),
        ),
      ));
    });
  } catch (e) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);">Failed to load. ${e.message}</p>`;
  }
}

function pill(label, active, onClick) {
  return h('button', { class: `pill tap${active ? ' active' : ''}`, onClick }, label);
}

// ===========================================================================
// SEARCH
// ===========================================================================
function renderSearch() {
  const wrap = h('div', { class: 'fade-up', style: { paddingBottom: '80px', minHeight: '100vh' } });
  wrap.append(h('div', { class: 'page-header', style: { paddingBottom: '8px' } },
    h('h1', { class: 'page-title' }, 'Search'),
  ));

  const inputWrap = h('div', {
    style: { margin: '0 16px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 14px' },
  },
    I('search', 16, { style: 'color:var(--muted); flex-shrink:0' }),
  );
  const inp = h('input', {
    type: 'text',
    placeholder: 'Search any game…',
    style: { flex: 1, background: 'transparent', border: 'none', color: 'white', fontSize: '14px', padding: '13px 0' },
    onInput: (e) => { state.search.q = e.target.value; doSearch(); },
  });
  inputWrap.append(inp);
  wrap.append(inputWrap);

  const results = h('div', { id: 'search-results', style: { padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '10px' } });
  wrap.append(results);

  setTimeout(() => inp.focus(), 80);
  doSearch(true);
  return wrap;
}

let searchDebounce = null;
async function doSearch(initial = false) {
  if (searchDebounce) clearTimeout(searchDebounce);
  const results = document.getElementById('search-results');
  if (!results) return;

  if (!state.search.q.trim()) {
    results.innerHTML = '';
    results.append(h('div', { style: { textAlign: 'center', padding: '48px 0' } },
      I('search', 40, { style: 'color:rgba(255,255,255,0.08)' }),
      h('p', { style: { color: 'var(--muted)', fontSize: '14px', marginTop: '12px' } }, 'Search millions of games'),
    ));
    return;
  }

  searchDebounce = setTimeout(async () => {
    results.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      results.append(h('div', { class: 'row-card' },
        h('div', { class: 'row-thumb skeleton' }),
        h('div', { style: { flex: 1 } },
          h('div', { class: 'skeleton', style: { height: '13px', marginBottom: '8px' } }),
          h('div', { class: 'skeleton', style: { height: '10px', width: '50%' } }),
        )
      ));
    }
    try {
      const games = await API.searchGames(state.search.q);
      results.innerHTML = '';
      if (!games.length) {
        results.append(h('p', { style: { textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: '14px' } }, `No results for "${state.search.q}"`));
        return;
      }
      games.forEach((g, i) => {
        results.append(h('div', {
          class: 'row-card tap',
          style: { animation: `fadeUp 0.25s ${i * 25}ms ease backwards` },
          onClick: () => { vib(20); state.activeGame = g; state.mode = 'detail'; render(); },
        },
          h('div', { class: 'row-thumb' },
            g.background_image ? h('img', { src: g.background_image, loading: 'lazy' }) : null,
          ),
          h('div', { style: { flex: 1, minWidth: 0 } },
            h('p', { class: 'line-clamp-1', style: { fontSize: '14px', fontWeight: 600 } }, g.name),
            h('p', { style: { fontSize: '11px', color: 'var(--muted)', marginTop: '3px' } }, (g.genres || []).map(x => x.name).join(', ') || '—'),
            h('div', { style: { display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' } },
              g.rating ? h('span', { style: { fontSize: '11px', fontWeight: 700, color: 'var(--gold)' } }, `★ ${g.rating.toFixed(1)}`) : null,
              g.released ? h('span', { style: { fontSize: '10px', color: 'var(--muted)' } }, g.released.slice(0, 4)) : null,
            ),
          ),
          I('chevronRight', 14, { style: 'color:var(--muted); flex-shrink:0' }),
        ));
      });
    } catch (e) {
      results.innerHTML = `<p style="text-align:center;padding:40px;color:var(--muted);">Search failed.</p>`;
    }
  }, 380);
}

// ===========================================================================
// RANKINGS
// ===========================================================================
function renderRankings() {
  const wrap = h('div', { class: 'fade-up', style: { paddingBottom: '80px', minHeight: '100vh' } });
  wrap.append(h('div', { class: 'page-header' },
    h('h1', { class: 'page-title' }, 'Rankings'),
    h('p', { class: 'page-sub' }, 'Best games of all time'),
  ));

  const TABS = [{ id: 'rating', label: 'User Rating' }, { id: 'metacritic', label: 'Metacritic' }, { id: 'reviews', label: 'Most Reviewed' }];
  wrap.append(h('div', { class: 'hide-scroll', style: { display: 'flex', gap: '8px', padding: '0 16px 20px', overflowX: 'auto' } },
    ...TABS.map(t => pill(t.label, state.rankingsTab === t.id, () => { vib(); state.rankingsTab = t.id; render(); })),
  ));

  const sorted = [...(state.games.top || [])].sort((a, b) => {
    if (state.rankingsTab === 'rating')     return (b.rating || 0) - (a.rating || 0);
    if (state.rankingsTab === 'metacritic') return (b.metacritic || 0) - (a.metacritic || 0);
    return (b.ratings_count || 0) - (a.ratings_count || 0);
  });

  if (!sorted.length) {
    wrap.append(h('p', { style: { textAlign: 'center', padding: '40px', color: 'var(--muted)' } }, 'Loading rankings…'));
    return wrap;
  }

  const list = h('div', { style: { padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '8px' } });
  sorted.forEach((game, i) => {
    const rank = i + 1;
    const val = state.rankingsTab === 'metacritic'
      ? (game.metacritic || '—')
      : state.rankingsTab === 'reviews'
      ? (game.ratings_count?.toLocaleString() || '—')
      : (game.rating?.toFixed(1) || '—');
    const topColor = rank === 1 ? 'var(--gold)' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : 'var(--muted)';

    list.append(h('div', {
      class: 'row-card tap',
      style: { animation: `fadeUp 0.25s ${Math.min(i, 10) * 30}ms ease backwards` },
      onClick: () => { vib(20); state.activeGame = game; state.mode = 'detail'; render(); },
    },
      h('div', { style: { width: '32px', textAlign: 'center', flexShrink: 0 } },
        h('span', { style: { fontSize: '14px', fontWeight: 800, color: topColor } }, String(rank)),
      ),
      h('div', { class: 'row-thumb' },
        game.background_image ? h('img', { src: game.background_image, loading: 'lazy' }) : null,
      ),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('p', { class: 'line-clamp-1', style: { fontSize: '13px', fontWeight: 600 } }, game.name),
        h('p', { style: { fontSize: '10px', color: 'var(--muted)', marginTop: '2px' } }, game.genres?.[0]?.name || ''),
      ),
      h('div', { style: { textAlign: 'right', flexShrink: 0 } },
        h('p', { style: { fontSize: '14px', fontWeight: 800, color: 'var(--gold)' } }, String(val)),
        h('p', { style: { fontSize: '9px', color: 'var(--muted)', marginTop: '2px', textTransform: 'uppercase' } },
          state.rankingsTab === 'metacritic' ? 'MC' : state.rankingsTab === 'reviews' ? 'votes' : '/ 5'),
      ),
    ));
  });
  wrap.append(list);
  return wrap;
}

// ===========================================================================
// VAULT
// ===========================================================================
function renderVault() {
  const wrap = h('div', { class: 'fade-up', style: { paddingBottom: '80px', minHeight: '100vh' } });
  const vault = Store.getState().vault;
  const status = Store.getState().status;
  const ratings = Store.getState().ratings;

  wrap.append(h('div', { class: 'page-header' },
    h('div', { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' } },
      h('div', null,
        h('h1', { class: 'page-title' }, 'My Vault'),
        h('p', { class: 'page-sub' }, `${vault.length} games tracked`),
      ),
      h('button', {
        class: 'tap btn-ghost',
        style: { display: 'flex', alignItems: 'center', gap: '6px' },
        onClick: () => { vib(); state.showImport = true; render(); },
      }, I('upload', 14), 'Import'),
    ),
  ));

  const FILTERS = [
    { id: 'all', label: 'All' }, { id: 'playing', label: 'Playing' },
    { id: 'played', label: 'Played' }, { id: 'backlog', label: 'Backlog' }, { id: 'dropped', label: 'Dropped' },
  ];
  wrap.append(h('div', { class: 'hide-scroll', style: { display: 'flex', gap: '8px', padding: '0 16px 16px', overflowX: 'auto' } },
    ...FILTERS.map(f => pill(f.label, state.vaultFilter === f.id, () => { vib(); state.vaultFilter = f.id; render(); })),
  ));

  const filtered = vault.filter(g => state.vaultFilter === 'all' || (status[g.id] || 'backlog') === state.vaultFilter);

  if (!filtered.length) {
    wrap.append(h('div', { style: { textAlign: 'center', padding: '60px 24px' } },
      I('library', 40, { style: 'color:rgba(255,255,255,0.1)' }),
      h('p', { style: { color: 'var(--muted)', marginTop: '12px', fontSize: '14px' } }, vault.length ? 'No games match this filter.' : 'No games yet. Import a list or search to add.'),
      !vault.length ? h('button', {
        class: 'tap btn-primary',
        style: { marginTop: '16px' },
        onClick: () => { vib(); state.showImport = true; render(); },
      }, '+ Add Games') : null,
    ));
    return wrap;
  }

  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '0 16px' } });
  filtered.forEach(game => {
    const s = status[game.id] || 'backlog';
    const r = ratings[game.id] || {};
    grid.append(h('div', {
      class: 'game-card tap',
      style: { cursor: 'pointer' },
      onClick: () => { vib(20); state.activeGame = game; state.mode = 'detail'; render(); },
    },
      h('div', { class: 'game-card-thumb', style: { position: 'relative' } },
        game.background_image ? h('img', { src: game.background_image, loading: 'lazy', onError: (e) => { e.target.style.opacity = '0.2'; } }) : h('div', { class: 'skeleton', style: { width: '100%', height: '100%' } }),
        h('div', { style: { position: 'absolute', top: '6px', right: '6px' } },
          h('span', { class: `badge badge-${s}` }, s),
        ),
        h('button', {
          style: { position: 'absolute', bottom: '6px', right: '6px', width: '26px', height: '26px', borderRadius: '7px', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
          onClick: (e) => { e.stopPropagation(); vib(30); Store.removeFromVault(game.id); toast('Removed'); render(); },
        }, I('trash', 11, { style: 'color:rgba(255,255,255,0.6)' })),
      ),
      h('div', { style: { padding: '10px' } },
        h('p', { class: 'line-clamp-1', style: { fontSize: '12px', fontWeight: 600 } }, game.name),
        r.rating ? h('p', { style: { fontSize: '10px', color: 'var(--gold)', marginTop: '2px' } }, `★ ${r.rating}/10`) : h('p', { style: { fontSize: '10px', color: 'var(--muted)', marginTop: '2px' } }, 'Unrated'),
      ),
    ));
  });
  wrap.append(grid);
  return wrap;
}

// ===========================================================================
// PROFILE
// ===========================================================================
function renderProfile() {
  const s = Store.getState();
  const vault = s.vault;
  const wishlist = s.wishlist;
  const steamConnected = !!s.settings.steamId;
  const avgRating = vault.reduce((a, g) => a + (s.ratings[g.id]?.rating || 0), 0) / Math.max(1, vault.filter(g => s.ratings[g.id]?.rating).length || 1);

  const wrap = h('div', { class: 'fade-up', style: { paddingBottom: '80px', minHeight: '100vh' } });
  wrap.append(h('div', { class: 'page-header' },
    h('h1', { class: 'page-title' }, 'Profile'),
    h('p', { class: 'page-sub' }, 'Your gaming stats'),
  ));

  // stat tiles
  const stats = [
    { label: 'Games', value: vault.length, icon: 'gamepad', color: 'var(--accent)' },
    { label: 'Wishlist', value: wishlist.length, icon: 'heart', color: '#ef4444' },
    { label: 'Avg Rating', value: vault.length ? avgRating.toFixed(1) : '—', icon: 'star', color: 'var(--gold)' },
  ];
  wrap.append(h('div', { class: 'stat-row', style: { padding: '0 16px 24px' } },
    ...stats.map(s => h('div', { class: 'stat-tile' },
      I(s.icon, 18, { style: `color:${s.color}; margin-bottom:6px` }),
      h('p', { class: 'stat-val' }, String(s.value)),
      h('p', { class: 'stat-label' }, s.label),
    )),
  ));

  // status breakdown
  const STATUS_LABELS = { playing: 'Playing', played: 'Played', backlog: 'Backlog', dropped: 'Dropped' };
  const statusCounts = { playing: 0, played: 0, backlog: 0, dropped: 0 };
  vault.forEach(g => { const st = s.status[g.id] || 'backlog'; if (statusCounts[st] !== undefined) statusCounts[st]++; });

  wrap.append(h('div', { style: { padding: '0 16px 24px' } },
    h('p', { style: { fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' } }, 'Collection'),
    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } },
      ...Object.entries(statusCounts).map(([key, count]) => h('div', {
        class: 'card',
        style: { padding: '14px', borderRadius: '12px', cursor: 'pointer' },
        onClick: () => { state.tab = 'vault'; state.vaultFilter = key; render(); },
      },
        h('p', { style: { fontSize: '20px', fontWeight: 800 } }, String(count)),
        h('p', { style: { fontSize: '12px', color: 'var(--muted)', marginTop: '2px' } }, STATUS_LABELS[key]),
      )),
    ),
  ));

  // steam
  wrap.append(h('div', { style: { padding: '0 16px 24px' } },
    h('p', { style: { fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' } }, 'Integrations'),
    h('div', { class: 'card', style: { padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '14px' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
        h('div', { style: { width: '42px', height: '42px', borderRadius: '10px', background: '#1b2838', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
          I('gamepad', 20, { style: 'color:white' }),
        ),
        h('div', null,
          h('p', { style: { fontSize: '14px', fontWeight: 700 } }, 'Steam'),
          h('p', { style: { fontSize: '11px', color: steamConnected ? 'var(--green)' : 'var(--muted)', marginTop: '2px' } },
            steamConnected ? `${vault.filter(g => g.source === 'steam').length} games synced` : 'Not connected'),
        ),
      ),
      h('button', {
        class: `tap ${steamConnected ? 'btn-ghost' : 'btn-primary'}`,
        style: { fontSize: '12px', padding: '8px 14px' },
        onClick: () => { vib(); state.showSteam = true; render(); },
      }, steamConnected ? 'Manage' : 'Connect'),
    ),
  ));

  // deals
  wrap.append(h('div', { style: { padding: '0 16px' } },
    h('p', { style: { fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' } }, 'Top Deals'),
    h('div', { id: 'deals-panel' },
      ...Array(3).fill(0).map(() => h('div', { class: 'row-card', style: { marginBottom: '8px' } },
        h('div', { class: 'skeleton row-thumb' }),
        h('div', { style: { flex: 1 } },
          h('div', { class: 'skeleton', style: { height: '12px', marginBottom: '6px' } }),
          h('div', { class: 'skeleton', style: { height: '10px', width: '60%' } }),
        )
      )),
    ),
  ));
  loadDeals();
  return wrap;
}

async function loadDeals() {
  const panel = document.getElementById('deals-panel');
  if (!panel) return;
  try {
    const deals = await API.topDeals();
    panel.innerHTML = '';
    deals.slice(0, 8).forEach(d => {
      const savings = parseFloat(d.savings).toFixed(0);
      panel.append(h('div', { class: 'row-card', style: { marginBottom: '8px' } },
        h('div', { style: { width: '56px', height: '36px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 } },
          h('img', { src: d.thumb, style: { width: '100%', height: '100%', objectFit: 'cover' }, loading: 'lazy', onError: (e) => { e.target.style.display = 'none'; } }),
        ),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('p', { class: 'line-clamp-1', style: { fontSize: '12px', fontWeight: 600 } }, d.title),
          h('p', { style: { fontSize: '11px', marginTop: '2px' } },
            h('span', { style: { color: 'var(--green)', fontWeight: 700 } }, `$${d.salePrice}`),
            h('span', { style: { color: 'var(--muted)' } }, ` · was $${d.normalPrice}`),
          ),
        ),
        h('a', {
          href: `https://www.cheapshark.com/redirect?dealID=${d.dealID}`,
          target: '_blank', rel: 'noopener',
          class: 'tap',
          style: { padding: '5px 10px', borderRadius: '8px', background: 'var(--green)', color: '#000', fontSize: '11px', fontWeight: 800, textDecoration: 'none', flexShrink: 0 },
        }, `-${savings}%`),
      ));
    });
  } catch {
    panel.innerHTML = `<p style="text-align:center;padding:20px;color:var(--muted);font-size:13px;">Deals unavailable.</p>`;
  }
}

// ===========================================================================
// GAME DETAIL
// ===========================================================================
function renderGameDetail(game) {
  const wrap = h('div', { class: 'detail-wrap' });

  // hero
  const hero = h('div', { class: 'detail-hero' },
    h('img', { src: game.background_image || '', onError: (e) => { e.target.style.display = 'none'; } }),
    h('div', { class: 'detail-hero-overlay' }),
    h('button', {
      class: 'tap', style: { position: 'absolute', top: '48px', left: '16px', width: '40px', height: '40px', background: 'rgba(0,0,0,0.6)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      onClick: () => { vib(); state.activeGame = null; state.mode = null; render(); },
    }, I('chevronLeft', 20)),
    h('button', {
      class: 'tap', style: { position: 'absolute', top: '48px', right: '16px', width: '40px', height: '40px', background: 'rgba(0,0,0,0.6)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      onClick: () => { vib(20); Store.toggleWishlist(game); toast(Store.inWishlist(game.id) ? '♥ Wishlisted' : 'Removed from wishlist'); render(); },
    }, I('heart', 18, { style: `color:${Store.inWishlist(game.id) ? '#ef4444' : 'rgba(255,255,255,0.6)'}; fill:${Store.inWishlist(game.id) ? '#ef4444' : 'none'}` })),
  );
  wrap.append(hero);

  // body
  const body = h('div', { class: 'detail-body' });

  // title row
  body.append(h('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: '16px', marginBottom: '8px' } },
    h('h1', { class: 'line-clamp-2', style: { fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px', flex: 1, marginRight: '12px', lineHeight: 1.2 } }, game.name),
    game.metacritic ? h('div', {
      style: {
        flexShrink: 0, padding: '4px 10px', borderRadius: '8px', border: `2px solid ${game.metacritic >= 80 ? 'var(--green)' : game.metacritic >= 60 ? 'var(--gold)' : 'var(--red)'}`,
        color: game.metacritic >= 80 ? 'var(--green)' : game.metacritic >= 60 ? 'var(--gold)' : 'var(--red)',
      },
    },
      h('p', { style: { fontSize: '16px', fontWeight: 800, textAlign: 'center' } }, String(game.metacritic)),
      h('p', { style: { fontSize: '8px', textAlign: 'center', opacity: 0.7 } }, 'MC'),
    ) : null,
  ));

  // genres
  if (game.genres?.length) {
    body.append(h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' } },
      ...game.genres.map(g => h('span', {
        style: { padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' },
      }, g.name)),
    ));
  }

  // stat row
  body.append(h('div', { class: 'stat-row' },
    statTile('★', game.rating?.toFixed(1) || '—', 'Rating', 'var(--gold)'),
    statTile('#', (game.ratings_count || 0).toLocaleString() || '—', 'Reviews'),
    statTile('📅', game.released?.slice(0, 4) || '—', 'Released'),
  ));

  // description
  if (game.description_raw) {
    body.append(
      h('p', { style: { fontSize: '13px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' } }, 'About'),
      h('p', { class: 'line-clamp-3', style: { fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: '20px' } }, game.description_raw),
    );
  }

  // screenshots
  if (game._screenshots?.length) {
    body.append(
      h('p', { style: { fontSize: '13px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' } }, 'Screenshots'),
      h('div', { class: 'hide-scroll', style: { display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '20px' } },
        ...game._screenshots.map(s => h('div', { style: { minWidth: '190px', height: '106px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: 'var(--surface)' } },
          h('img', { src: s.image, style: { width: '100%', height: '100%', objectFit: 'cover' }, loading: 'lazy' })),
        ),
      ),
    );
  }

  // platforms
  if (game._platforms?.length) {
    body.append(
      h('p', { style: { fontSize: '13px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' } }, 'Platforms'),
      h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' } },
        ...game._platforms.map(p => h('span', { style: { padding: '4px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 600, background: 'var(--surface2)', color: 'rgba(255,255,255,0.6)', border: '1px solid var(--border)' } }, p)),
      ),
    );
  }

  // AI review
  body.append(renderAIReview(game));

  // personal
  body.append(renderPersonalSection(game));

  // action buttons
  body.append(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' } },
    h('button', {
      class: 'tap btn-primary',
      style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
      onClick: () => { vib(30); state.mode = 'stream'; render(); },
    }, I('play', 15, { style: 'color:white' }), 'Watch'),
    h('button', {
      class: `tap ${Store.inVault(game.id) ? 'btn-primary' : 'btn-ghost'}`,
      style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
      onClick: () => {
        vib(20);
        if (Store.inVault(game.id)) Store.removeFromVault(game.id);
        else Store.addToVault(game);
        toast(Store.inVault(game.id) ? 'Added to vault' : 'Removed');
        render();
      },
    }, Store.inVault(game.id) ? I('check', 15) : I('plus', 15), Store.inVault(game.id) ? 'Saved' : 'Add'),
  ));

  // deals
  const dealsBox = h('div', { id: 'game-deals', style: { marginTop: '16px' } });
  body.append(dealsBox);
  loadGameDeals(game);

  wrap.append(body);
  if (!game._details_loaded) loadGameExtras(game);
  return wrap;
}

function statTile(icon, value, label, color = 'var(--text)') {
  return h('div', { class: 'stat-tile' },
    h('p', { class: 'stat-val', style: { color } }, `${icon} ${value}`),
    h('p', { class: 'stat-label' }, label),
  );
}

function renderAIReview(game) {
  const box = h('div', { class: 'card', style: { padding: '14px', borderRadius: '14px', marginBottom: '16px' } },
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        I('bot', 15, { style: 'color:var(--accent)' }),
        h('span', { style: { fontSize: '13px', fontWeight: 700 } }, 'AI Review'),
      ),
      h('button', {
        id: 'ai-generate-btn', class: 'tap btn-ghost',
        style: { fontSize: '11px', padding: '5px 10px' },
        onClick: async () => {
          const btn = document.getElementById('ai-generate-btn');
          const out = document.getElementById('ai-output');
          if (!btn || !out) return;
          btn.disabled = true; btn.textContent = '…';
          out.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px;"><div class="spin" style="width:14px;height:14px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;"></div>Generating…</div>`;
          const res = await API.askAI(`Give a punchy 2-sentence review of "${game.name}" (rating ${game.rating || '?'}/5, MC ${game.metacritic || 'N/A'}). Be specific and opinionated.`);
          out.innerHTML = '';
          out.append(h('p', { style: { fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 } }, res.text));
          btn.style.display = 'none';
        },
      }, 'Generate'),
    ),
    h('div', { id: 'ai-output' },
      h('p', { style: { fontSize: '12px', color: 'var(--muted)' } }, 'Tap Generate for an AI take on this game.'),
    ),
  );
  return box;
}

function renderPersonalSection(game) {
  const status = Store.getStatus(game.id);
  const entry = Store.getEntry(game.id);
  const STATUSES = [
    { id: 'backlog', label: 'Backlog' }, { id: 'playing', label: 'Playing' },
    { id: 'played', label: 'Played' }, { id: 'dropped', label: 'Dropped' },
  ];

  return h('div', { class: 'card', style: { padding: '14px', borderRadius: '14px', marginBottom: '16px' } },
    h('p', { style: { fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' } }, 'Status'),
    h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' } },
      ...STATUSES.map(s => h('button', {
        class: `tap pill${status === s.id ? ' active' : ''}`,
        onClick: () => { vib(); Store.setStatus(game.id, s.id); if (!Store.inVault(game.id)) Store.addToVault({ id: game.id, name: game.name, background_image: game.background_image }); render(); },
      }, s.label)),
    ),
    h('p', { style: { fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' } }, `Your Rating: ${entry.rating || '—'}/10`),
    h('div', { class: 'rating-grid', style: { marginBottom: '14px' } },
      ...Array(10).fill(0).map((_, i) => h('button', {
        class: `rating-btn tap${(entry.rating || 0) > i ? ' lit' : ''}`,
        onClick: () => { vib(); Store.setRating(game.id, i + 1); render(); },
      }, String(i + 1))),
    ),
    h('p', { style: { fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' } }, 'Notes'),
    h('textarea', {
      class: 'input',
      placeholder: 'Your thoughts…',
      value: entry.notes || '',
      style: { minHeight: '80px', resize: 'vertical' },
      onInput: (e) => Store.setNotes(game.id, e.target.value),
    }),
  );
}

async function loadGameExtras(game) {
  try {
    const [details, ss] = await Promise.all([API.gameDetails(game.id), API.gameScreenshots(game.id)]);
    Object.assign(game, {
      _details_loaded: true,
      description_raw: details.description_raw || game.description_raw,
      _screenshots: ss.slice(0, 6),
      _platforms: (details.platforms || []).slice(0, 6).map(p => p.platform.name),
    });
    render();
  } catch (e) { console.warn('extras failed', e); }
}

async function loadGameDeals(game) {
  const box = document.getElementById('game-deals');
  if (!box) return;
  try {
    const results = await API.lookupGame(game.name);
    if (!results.length) return;
    const cs = results[0];
    const deals = await API.gameDeals(cs.gameID);
    if (!deals.deals?.length) return;
    const best = deals.deals.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
    const savings = parseFloat(best.savings).toFixed(0);
    box.append(
      h('p', { style: { fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' } }, 'Best Price'),
      h('a', {
        href: `https://www.cheapshark.com/redirect?dealID=${best.dealID}`,
        target: '_blank', rel: 'noopener',
        class: 'tap row-card',
        style: { display: 'flex', textDecoration: 'none', marginBottom: '8px' },
      },
        h('div', { style: { flex: 1 } },
          h('p', { style: { fontSize: '13px', fontWeight: 600 } }, best.storeName),
          h('p', { style: { fontSize: '16px', fontWeight: 800, color: 'var(--green)', marginTop: '2px' } }, `$${best.price}`,
            h('span', { style: { fontSize: '11px', color: 'var(--muted)', textDecoration: 'line-through', marginLeft: '8px' } }, `$${best.retailPrice}`),
          ),
        ),
        h('span', { style: { padding: '6px 12px', borderRadius: '8px', background: 'var(--green)', color: '#000', fontSize: '12px', fontWeight: 800, alignSelf: 'center' } }, `-${savings}%`),
      ),
    );
  } catch {}
}

// ===========================================================================
// STREAM MODAL
// ===========================================================================
function renderStreamModal(game) {
  const wrap = h('div', { style: { position: 'fixed', inset: 0, zIndex: 50, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } });

  wrap.append(h('div', {
    style: { padding: '48px 16px 12px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  },
    h('button', {
      class: 'tap', style: { width: '40px', height: '40px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      onClick: () => { vib(); state.activeGame = null; state.mode = null; render(); },
    }, I('chevronLeft', 20)),
    h('div', null,
      h('p', { style: { fontSize: '16px', fontWeight: 700 } }, 'Live Streams'),
      h('p', { style: { fontSize: '12px', color: 'var(--accent)' } }, game.name),
    ),
  ));

  const list = h('div', { id: 'stream-list', class: 'hide-scroll', style: { flex: 1, overflowY: 'auto', padding: '16px' } });
  const chat = h('div', { style: { height: '38vh', flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--surface)' } });
  wrap.append(list, chat);
  loadStreams(game, list, chat);
  return wrap;
}

async function loadStreams(game, list, chat) {
  list.innerHTML = '';
  list.append(h('p', { style: { textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '20px 0' } },
    h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px' } },
      h('span', { style: { width: '14px', height: '14px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }, class: 'spin' }),
      'Finding streams…',
    ),
  ));

  let streams = await API.liveStreamsForGame(game.name, 10);
  if (!streams.length) streams = await API.liveStreamsFeatured(10);

  list.innerHTML = '';
  if (!streams.length) {
    list.append(h('p', { style: { textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: '14px' } }, 'No live streams right now.'));
    return;
  }

  renderStreamEmbed(chat, streams[0].user_login);
  list.append(h('p', { style: { fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' } }, `${streams.length} live`));

  streams.forEach(s => {
    const thumb = s.thumbnail_url?.replace('{width}', 320).replace('{height}', 180);
    list.append(h('div', {
      class: 'game-card tap',
      style: { marginBottom: '10px', cursor: 'pointer' },
      onClick: () => { vib(); renderStreamEmbed(chat, s.user_login); },
    },
      thumb ? h('div', { style: { position: 'relative' } },
        h('img', { src: thumb, style: { width: '100%', height: '160px', objectFit: 'cover', display: 'block' }, loading: 'lazy' }),
        h('span', { style: { position: 'absolute', top: '8px', left: '8px', background: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '5px' } }, 'LIVE'),
        h('span', { style: { position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.8)', color: 'white', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px' } }, `${(s.viewer_count || 0).toLocaleString()} viewers`),
      ) : null,
      h('div', { style: { padding: '10px' } },
        h('p', { class: 'line-clamp-1', style: { fontSize: '13px', fontWeight: 600 } }, s.title),
        h('p', { style: { fontSize: '11px', color: 'var(--muted)', marginTop: '2px' } }, `${s.user_name} · ${s.game_name}`),
      ),
    ));
  });
}

function renderStreamEmbed(chatHost, channel) {
  chatHost.innerHTML = '';
  chatHost.append(h('iframe', {
    src: API.twitchEmbedUrl(channel),
    style: { width: '100%', height: '100%', border: 'none' },
    allowFullscreen: true,
    allow: 'autoplay; fullscreen',
  }));
}

// ===========================================================================
// IMPORT MODAL
// ===========================================================================
function renderImportModal() {
  let text = '';
  const ta = h('textarea', {
    class: 'input',
    placeholder: 'One game per line:\nElden Ring\nHades\nCyberpunk 2077',
    style: { minHeight: '160px', resize: 'none' },
    onInput: (e) => { text = e.target.value; updateCount(); },
  });
  const countEl = h('span', { style: { fontSize: '12px', color: 'var(--muted)' } }, '0 games');
  const btn = h('button', {
    class: 'tap btn-primary', disabled: true,
    style: { width: '100%', marginTop: '14px' },
    onClick: async () => {
      const titles = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (!titles.length) return;
      btn.disabled = true; btn.textContent = 'Importing…';
      let added = 0;
      for (const title of titles) {
        try {
          const r = await API.searchGames(title);
          if (r[0]) { Store.addToVault({ ...r[0], status: 'backlog' }); added++; }
          else { Store.addToVault({ id: 'manual-' + Date.now() + '-' + Math.random(), name: title, background_image: null, rating: 0, status: 'backlog' }); added++; }
        } catch {}
      }
      toast(`Imported ${added} game${added !== 1 ? 's' : ''}`);
      state.showImport = false; render();
    },
  }, 'Import');

  function updateCount() {
    const n = text.split('\n').filter(l => l.trim()).length;
    countEl.textContent = `${n} game${n !== 1 ? 's' : ''}`;
    btn.disabled = n === 0;
    btn.textContent = n > 0 ? `Import ${n} Game${n !== 1 ? 's' : ''}` : 'Import';
  }

  return h('div', { class: 'modal-backdrop', onClick: (e) => { if (e.target.classList.contains('modal-backdrop')) { state.showImport = false; render(); } } },
    h('div', { class: 'modal-sheet' },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' } },
        h('h3', { style: { fontSize: '18px', fontWeight: 800 } }, 'Import Games'),
        h('button', { class: 'tap', style: { color: 'var(--muted)', padding: '4px' }, onClick: () => { state.showImport = false; render(); } }, I('x', 18)),
      ),
      ta,
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' } },
        countEl,
        h('span', { style: { fontSize: '11px', color: 'var(--muted)' } }, 'Resolved via RAWG'),
      ),
      btn,
    ),
  );
}

// ===========================================================================
// STEAM MODAL
// ===========================================================================
function renderSteamModal() {
  let input;
  return h('div', { class: 'modal-backdrop', onClick: (e) => { if (e.target.classList.contains('modal-backdrop')) { state.showSteam = false; render(); } } },
    h('div', { class: 'modal-sheet' },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' } },
        h('h3', { style: { fontSize: '18px', fontWeight: 800 } }, 'Connect Steam'),
        h('button', { class: 'tap', style: { color: 'var(--muted)', padding: '4px' }, onClick: () => { state.showSteam = false; render(); } }, I('x', 18)),
      ),
      h('p', { style: { fontSize: '13px', color: 'var(--muted)', marginBottom: '14px' } },
        'Enter your SteamID64 from ',
        h('a', { href: 'https://steamid.io', target: '_blank', rel: 'noopener' }, 'steamid.io'),
        '. Profile must be Public.',
      ),
      h('input', {
        ref: el => input = el,
        type: 'text',
        class: 'input',
        placeholder: 'e.g. 76561198000000000',
        style: { fontFamily: 'monospace' },
      }),
      h('button', {
        class: 'tap btn-primary',
        style: { width: '100%', marginTop: '14px' },
        onClick: async (e) => {
          const sid = input?.value?.trim();
          if (!/^\d{17}$/.test(sid || '')) { toast('Invalid SteamID64'); return; }
          const btn = e.currentTarget;
          btn.disabled = true; btn.textContent = 'Importing…';
          const games = await API.steamLibrary(sid);
          if (!games.length) { toast('No public games found'); btn.disabled = false; btn.textContent = 'Try Again'; return; }
          Store.setSetting('steamId', sid);
          games.forEach(g => { if (!Store.inVault(g.id)) Store.addToVault(g); });
          toast(`Imported ${games.length} Steam games`);
          state.showSteam = false; render();
        },
      }, 'Import Library'),
    ),
  );
}

// ===========================================================================
// AI MODAL
// ===========================================================================
function renderAIModal() {
  const messages = [{ role: 'assistant', content: "Hey! I'm NexusAI 🎮 Ask me anything — recs, what to play, hidden gems, strategy tips." }];

  const list = h('div', { class: 'hide-scroll', style: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' } });
  const inp = h('input', {
    type: 'text', class: 'input',
    placeholder: 'Ask anything about games…',
    style: { flex: 1 },
  });

  function addMsg(m) {
    messages.push(m);
    const isUser = m.role === 'user';
    list.append(h('div', { style: { display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', gap: '8px', alignItems: 'flex-end' } },
      !isUser ? h('div', { style: { width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, I('bot', 13, { style: 'color:white' })) : null,
      h('div', { style: {
        maxWidth: '80%', padding: '10px 14px', borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser ? 'var(--accent)' : 'var(--surface2)',
        border: isUser ? 'none' : '1px solid var(--border)',
        fontSize: '13px', lineHeight: 1.5, color: 'white',
      } }, m.content),
    ));
    list.scrollTop = list.scrollHeight;
  }
  addMsg(messages[0]);

  const QUICK = ['What to play tonight?', 'Best RPGs ever?', 'Hidden indie gems?', 'Elden Ring vs Dark Souls'];
  list.append(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' } },
    ...QUICK.map(q => h('button', {
      class: 'tap card',
      style: { padding: '10px', textAlign: 'left', fontSize: '11px', color: 'var(--muted)', borderRadius: '10px', cursor: 'pointer' },
      onClick: () => { inp.value = q; inp.focus(); },
    }, q)),
  ));

  const sendBtn = h('button', {
    class: 'tap',
    style: { width: '42px', height: '42px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(108,99,255,0.4)' },
    onClick: send,
  }, I('send', 15, { style: 'color:white' }));

  async function send() {
    const q = inp.value.trim();
    if (!q) return;
    vib();
    addMsg({ role: 'user', content: q });
    inp.value = '';
    sendBtn.disabled = true;
    const typing = h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center', padding: '8px 0' } },
      ...[0,1,2].map(i => h('div', { style: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', animation: `fadeUp 0.8s ${i * 0.15}s ease infinite alternate` } })),
    );
    list.append(typing);
    list.scrollTop = list.scrollHeight;
    const res = await API.askAI(q);
    typing.remove();
    addMsg({ role: 'assistant', content: res.text });
    sendBtn.disabled = false;
  }
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

  const wrap = h('div', { style: { position: 'fixed', inset: 0, zIndex: 50, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } });
  wrap.append(
    h('div', { style: { padding: '48px 16px 12px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', flexShrink: 0 } },
      h('button', { class: 'tap', style: { width: '40px', height: '40px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        onClick: () => { state.showAI = false; render(); } }, I('chevronLeft', 20)),
      h('div', { style: { width: '36px', height: '36px', borderRadius: '10px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, I('bot', 18, { style: 'color:white' })),
      h('div', null,
        h('p', { style: { fontSize: '15px', fontWeight: 700 } }, 'NexusAI'),
        h('p', { style: { fontSize: '11px', color: 'var(--accent)' } }, 'Gaming Assistant'),
      ),
    ),
    list,
    h('div', { style: { padding: '12px 16px', display: 'flex', gap: '10px', borderTop: '1px solid var(--border)', alignItems: 'center', background: 'var(--bg)', flexShrink: 0 } },
      inp, sendBtn,
    ),
  );
  return wrap;
}

// ===========================================================================
// BOOT
// ===========================================================================
async function boot() {
  try {
    const [trending, top, upcoming] = await Promise.all([
      API.trendingGames(),
      API.topGames(),
      API.upcomingGames(),
    ]);
    state.games = { trending, top, upcoming };
  } catch (e) {
    console.error('boot failed:', e);
    toast('Could not load games — check connection');
  }
  state.loading = false;
  setTimeout(() => { state.bootDone = true; render(); }, 500);
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  render();
  boot();
});
