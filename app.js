// =========================================================================
// app.js — vanilla JS, no framework. Renders into #app.
// =========================================================================
import * as API from './api.js';
import * as Store from './store.js';
import { I } from './icons.js';

// ---------------------------------------------------------------------------
// tiny DOM helpers
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

const vib = (ms = 25) => { try { navigator.vibrate?.(ms); } catch {} };

let toastTimer = null;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = h('div', { class: 'toast' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------------------------------------------------------------------------
// view state
// ---------------------------------------------------------------------------
const state = {
  tab: 'home',
  games: { trending: [], upcoming: [], top: [] },
  loading: true,
  activeGame: null,
  mode: null,           // 'detail' | 'stream'
  showImport: false,
  showAI: false,
  showSteam: false,
  filters: { genre: '', platform: '' },
  search: { q: '', results: [], loading: false },
  deals: [],
  bootDone: false,
};

// ---------------------------------------------------------------------------
// top-level app shell
// ---------------------------------------------------------------------------
function render() {
  const root = document.getElementById('app');
  root.innerHTML = '';

  // background orbs
  root.append(
    h('div', { class: 'orb', style: { width: '70vw', height: '70vw', background: 'var(--purple)', top: '-15%', left: '-10%' } }),
    h('div', { class: 'orb', style: { width: '55vw', height: '55vw', background: 'var(--cyan)', bottom: '-10%', right: '-10%', animationDelay: '-9s' } }),
    h('div', { class: 'orb', style: { width: '40vw', height: '40vw', background: 'var(--pink)', top: '35%', left: '15%', animationDelay: '-5s' } }),
  );

  if (!state.bootDone) {
    root.append(renderBoot());
    return;
  }

  if (state.activeGame && state.mode === 'detail') {
    root.append(renderGameDetail(state.activeGame));
  } else if (state.activeGame && state.mode === 'stream') {
    root.append(renderStreamModal(state.activeGame));
  } else {
    root.append(renderTab());
  }

  // modals
  if (state.showImport) root.append(renderImportModal());
  if (state.showAI)     root.append(renderAIModal());
  if (state.showSteam)  root.append(renderSteamModal());

  // floating AI button + bottom nav (only on main tabs, not modals)
  const inModal = state.activeGame || state.showImport || state.showAI || state.showSteam;
  if (!inModal) {
    root.append(
      h('button', {
        class: 'bounce',
        style: {
          position: 'fixed', bottom: '110px', right: '20px', zIndex: 40,
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--purple), var(--cyan))',
          boxShadow: '0 0 25px rgba(112,0,255,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        },
        onClick: () => { vib(50); state.showAI = true; render(); },
      }, I('bot', 22, { style: 'color:white' })),
      renderNav(),
    );
  }
}

// ---------------------------------------------------------------------------
// boot screen
// ---------------------------------------------------------------------------
function renderBoot() {
  return h('div', {
    class: 'fixed inset-0',
    style: { background: '#050505', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' },
  },
    h('div', {
      class: 'float',
      style: { width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--purple), var(--cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    }, I('gamepad', 32, { style: 'color:white' })),
    h('div', { style: { textAlign: 'center' } },
      h('h1', { class: 'font-orb', style: { fontSize: '24px', fontWeight: 900, margin: 0 } }, 'NexusCore'),
      h('p', { style: { color: 'rgba(255,255,255,0.4)', fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', margin: '4px 0 0' } }, 'Ultimate Gaming OS'),
    ),
    h('div', { style: { width: '200px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden' } },
      h('div', { class: 'shimmer', style: { width: '100%', height: '100%' } }),
    ),
    h('p', { class: 'font-orb', style: { color: 'var(--cyan)', fontSize: '11px', letterSpacing: '0.3em', animation: 'pulse-glow 2s infinite' } }, 'INITIALIZING...'),
  );
}

// ---------------------------------------------------------------------------
// bottom nav
// ---------------------------------------------------------------------------
function renderNav() {
  const NAV = [
    { id: 'home',     icon: 'home',     label: 'Nexus' },
    { id: 'explore',  icon: 'compass',  label: 'Explore' },
    { id: 'search',   icon: 'search',   label: 'Search' },
    { id: 'rankings', icon: 'trending', label: 'Ranks' },
    { id: 'vault',    icon: 'library',  label: 'Vault' },
    { id: 'profile',  icon: 'user',     label: 'ID' },
  ];
  return h('nav', {
    class: 'glass',
    style: {
      position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
      padding: '8px', borderRadius: '32px', display: 'flex', zIndex: 40,
      width: '96%', maxWidth: '480px', justifyContent: 'space-between',
      border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
    },
  },
    ...NAV.map(item => {
      const active = state.tab === item.id;
      return h('button', {
        class: 'bounce',
        style: {
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '8px 12px', borderRadius: '20px', gap: '4px',
          background: active ? 'linear-gradient(135deg, var(--cyan), var(--purple))' : 'transparent',
          color: active ? '#000' : 'rgba(255,255,255,0.4)',
          boxShadow: active ? '0 0 15px rgba(0,240,255,0.3)' : 'none',
          minWidth: '54px',
        },
        onClick: () => { vib(20); state.tab = item.id; render(); },
      },
        I(item.icon, 18, { style: active ? 'color:#000' : '' }),
        h('span', { style: { fontSize: '9px', fontWeight: 700 } }, item.label),
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
// HOME — hero carousel + shelves
// ===========================================================================
function renderHome() {
  const wrap = h('div', { class: 'spring-up', style: { paddingTop: '16px', paddingBottom: '140px' } });

  if (state.loading) {
    wrap.append(
      h('div', { class: 'skeleton', style: { margin: '16px', height: '58vh', borderRadius: '40px' } }),
      h('div', { class: 'skeleton', style: { margin: '40px 24px 8px', height: '20px', width: '160px' } }),
      h('div', { class: 'skeleton', style: { margin: '12px 24px', height: '180px', borderRadius: '20px' } }),
    );
    return wrap;
  }

  const hero = state.games.trending.slice(0, 5);

  // hero carousel
  const heroEl = h('div', {
    class: 'snap-x hide-scroll',
    style: { display: 'flex', overflowX: 'auto', padding: '0 16px', gap: '16px', height: '58vh' },
  });

  hero.forEach(game => {
    heroEl.append(h('div', {
      class: 'snap-start bounce no-select',
      style: {
        minWidth: '100%', height: '100%', position: 'relative',
        borderRadius: '40px', overflow: 'hidden', cursor: 'pointer',
      },
      onClick: () => { vib(40); state.activeGame = game; state.mode = 'stream'; render(); },
    },
      h('img', {
        src: API.safeImage(game.background_image),
        style: { width: '100%', height: '100%', objectFit: 'cover' },
        loading: 'lazy',
        onError: (e) => { e.target.style.display = 'none'; },
      }),
      h('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(to top, #050505, rgba(5,5,5,0.3), transparent)' } }),
      h('div', { style: { position: 'absolute', top: '24px', left: '24px', display: 'flex', gap: '8px', alignItems: 'center' } },
        h('span', {
          class: 'font-orb',
          style: { background: 'var(--pink)', color: 'white', padding: '4px 12px', borderRadius: '999px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', boxShadow: '0 0 12px var(--pink)' },
        }, h('span', { style: { animation: 'pulse-glow 2s infinite', display: 'inline-block', marginRight: '6px' } }, '●'), 'Live'),
        game.metacritic
          ? h('span', { class: 'glass', style: { padding: '4px 12px', borderRadius: '999px', fontSize: '10px', fontWeight: 900, color: 'var(--gold)' } }, `MC ${game.metacritic}`)
          : null,
      ),
      h('div', { style: { position: 'absolute', bottom: '32px', left: '24px', right: '24px' } },
        h('h1', { class: 'font-orb', style: { fontSize: '28px', fontWeight: 900, margin: 0, lineHeight: 1, textShadow: '0 4px 12px rgba(0,0,0,0.8)' } }, game.name),
        h('p', { style: { color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '8px 0 16px' } }, (game.genres || []).map(g => g.name).join(' · ') || 'Featured'),
        h('div', { style: { display: 'flex', gap: '12px' } },
          h('button', {
            class: 'bounce',
            style: { flex: 1, background: 'white', color: 'black', fontWeight: 900, padding: '12px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' },
            onClick: (e) => { e.stopPropagation(); vib(40); state.activeGame = game; state.mode = 'stream'; render(); },
          }, I('play', 16, { style: 'color:black' }), 'Watch Stream'),
          h('button', {
            class: 'bounce glass',
            style: { padding: '12px 16px', borderRadius: '20px', fontWeight: 700, fontSize: '14px', color: 'var(--cyan)', border: '1px solid rgba(0,240,255,0.4)' },
            onClick: (e) => { e.stopPropagation(); vib(30); state.activeGame = game; state.mode = 'detail'; render(); },
          }, 'Info'),
        ),
      ),
    ));
  });

  wrap.append(heroEl);

  // hero dots
  wrap.append(h('div', { style: { display: 'flex', justifyContent: 'center', gap: '6px', margin: '12px 0 8px' } },
    ...hero.map((_, i) => h('div', {
      style: {
        width: i === 0 ? '16px' : '6px', height: '6px', borderRadius: '999px',
        background: i === 0 ? 'var(--cyan)' : 'rgba(255,255,255,0.2)', transition: 'all 0.3s',
      },
    })),
  ));

  wrap.append(renderShelf('Trending Now', state.games.trending, 'flame', 'var(--pink)'));
  wrap.append(renderShelf('Upcoming Releases', state.games.upcoming, 'clock', 'var(--cyan)'));
  wrap.append(renderShelf('Hall of Fame', state.games.top, 'trophy', 'var(--gold)', true));

  return wrap;
}

function renderShelf(title, data, icon, color, ranked = false) {
  return h('div', { style: { marginTop: '32px' } },
    h('div', { style: { padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' } },
      h('h2', { class: 'font-orb', style: { fontSize: '16px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 } },
        I(icon, 18, { style: `color:${color}` }), title),
      I('chevronRight', 16, { style: 'color:rgba(255,255,255,0.3)' }),
    ),
    h('div', { class: 'snap-x hide-scroll', style: { display: 'flex', gap: '16px', padding: '0 24px 8px', overflowX: 'auto' } },
      ...(state.loading
        ? Array(5).fill(0).map(() => h('div', { style: { minWidth: '150px' } },
            h('div', { class: 'skeleton', style: { aspectRatio: '3/4', borderRadius: '28px', marginBottom: '8px' } }),
            h('div', { class: 'skeleton', style: { height: '12px', marginBottom: '4px' } }),
            h('div', { class: 'skeleton', style: { height: '12px', width: '60%' } }),
          ))
        : data.map((g, i) => renderGameCard(g, { rank: ranked ? i + 1 : null }))),
    ),
  );
}

function renderGameCard(game, opts = {}) {
  return h('div', {
    class: 'snap-start bounce no-select',
    style: { minWidth: '150px', width: '150px', cursor: 'pointer' },
    onClick: () => { vib(30); state.activeGame = game; state.mode = 'detail'; render(); },
  },
    h('div', {
      style: { position: 'relative', aspectRatio: '3/4', borderRadius: '28px', overflow: 'hidden', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' },
    },
      game.background_image
        ? h('img', { src: game.background_image, style: { width: '100%', height: '100%', objectFit: 'cover' }, loading: 'lazy',
            onError: (e) => { e.target.style.opacity = '0.2'; } })
        : h('div', { class: 'skeleton', style: { width: '100%', height: '100%' } }),
      opts.rank
        ? h('div', {
            class: `font-orb ${opts.rank === 1 ? 'rank-1' : opts.rank === 2 ? 'rank-2' : opts.rank === 3 ? 'rank-3' : ''}`,
            style: {
              position: 'absolute', top: '8px', left: '8px',
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'var(--glass)', backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 900,
            },
          }, String(opts.rank))
        : null,
      h('div', {
        class: 'glass',
        style: { position: 'absolute', bottom: '8px', left: '8px', right: '8px', padding: '6px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' },
      },
        I('star', 9, { style: 'color:var(--gold); fill:var(--gold)' }),
        h('span', { style: { fontSize: '11px', fontWeight: 700 } }, game.rating?.toFixed(1) || '—'),
      ),
    ),
    h('h3', { class: 'line-clamp-1', style: { fontSize: '13px', fontWeight: 700, margin: 0, padding: '0 4px' } }, game.name),
    (game.genres?.[0])
      ? h('p', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0', padding: '0 4px' } }, game.genres[0].name)
      : null,
  );
}

// ===========================================================================
// EXPLORE — genre + platform filters
// ===========================================================================
function renderExplore() {
  const wrap = h('div', { class: 'spring-up', style: { paddingTop: '48px', paddingBottom: '140px', minHeight: '100vh' } });

  wrap.append(h('div', { style: { padding: '0 24px', marginBottom: '16px' } },
    h('h1', { class: 'font-orb', style: { fontSize: '28px', fontWeight: 900, margin: 0 } }, 'Explore'),
    h('p', { style: { color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '4px 0 0' } }, 'Discover your next obsession'),
  ));

  const PLATFORMS = [
    { id: '',    label: 'All' },
    { id: '4',   label: 'PC' },
    { id: '187', label: 'PS5' },
    { id: '1',   label: 'Xbox' },
    { id: '7',   label: 'Switch' },
    { id: '3',   label: 'iOS' },
  ];
  const GENRES = ['Action', 'RPG', 'Shooter', 'Strategy', 'Horror', 'Indie', 'Sports', 'Racing', 'Adventure', 'Simulation', 'Puzzle', 'Platformer'];

  wrap.append(h('div', { class: 'hide-scroll', style: { display: 'flex', gap: '8px', padding: '0 24px 8px', overflowX: 'auto' } },
    ...PLATFORMS.map(p => filterPill(p.label, state.filters.platform === p.id, () => { vib(); state.filters.platform = p.id; refreshExplore(); })),
  ));
  wrap.append(h('div', { class: 'hide-scroll', style: { display: 'flex', gap: '8px', padding: '0 24px 16px', overflowX: 'auto' } },
    filterPill('All', !state.filters.genre, () => { vib(); state.filters.genre = ''; refreshExplore(); }),
    ...GENRES.map(g => filterPill(g, state.filters.genre === g, () => { vib(); state.filters.genre = g; refreshExplore(); })),
  ));

  const grid = h('div', { id: 'explore-grid', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '0 16px' } });
  wrap.append(grid);

  refreshExplore(true);
  return wrap;
}

async function refreshExplore(initial = false) {
  const grid = document.getElementById('explore-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    grid.append(h('div', { class: 'glass', style: { borderRadius: '32px', overflow: 'hidden' } },
      h('div', { class: 'skeleton', style: { aspectRatio: '4/3' } }),
      h('div', { style: { padding: '12px' } },
        h('div', { class: 'skeleton', style: { height: '12px', marginBottom: '8px' } }),
        h('div', { class: 'skeleton', style: { height: '12px', width: '60%' } }),
      )));
  }
  try {
    const results = await API.browseGames({ genre: state.filters.genre, platform: state.filters.platform });
    grid.innerHTML = '';
    if (!results.length) {
      grid.append(h('div', { style: { gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' } },
        h('p', null, 'No games match these filters. Try different ones.')));
      return;
    }
    results.forEach((g, i) => {
      grid.append(h('div', {
        class: 'glass bounce',
        style: { borderRadius: '32px', overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)', animation: `fadeIn 0.4s ${i * 30}ms ease backwards` },
        onClick: () => { vib(30); state.activeGame = g; state.mode = 'detail'; render(); },
      },
        h('div', { style: { aspectRatio: '4/3', position: 'relative' } },
          g.background_image
            ? h('img', { src: g.background_image, style: { width: '100%', height: '100%', objectFit: 'cover' }, loading: 'lazy' })
            : h('div', { class: 'skeleton', style: { width: '100%', height: '100%' } }),
          h('div', { class: 'glass', style: { position: 'absolute', bottom: '8px', right: '8px', padding: '4px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' } },
            I('star', 9, { style: 'color:var(--gold); fill:var(--gold)' }),
            h('span', { style: { fontSize: '10px', fontWeight: 700 } }, g.rating?.toFixed(1) || '—'))),
        h('div', { style: { padding: '12px' } },
          h('h3', { class: 'line-clamp-1', style: { fontSize: '13px', fontWeight: 700, margin: 0 } }, g.name),
          h('p', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' } }, g.genres?.[0]?.name || 'Game')),
      ));
    });
  } catch (e) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:rgba(255,255,255,0.4);">Failed to load games. ${e.message}</div>`;
  }
}

function filterPill(label, active, onClick) {
  return h('button', {
    class: 'bounce',
    style: {
      padding: '8px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
      background: active ? 'var(--cyan)' : 'var(--glass)',
      color: active ? '#000' : 'rgba(255,255,255,0.6)',
      border: active ? '1px solid var(--cyan)' : '1px solid rgba(255,255,255,0.1)',
      boxShadow: active ? '0 0 15px var(--cyan)' : 'none',
    },
    onClick,
  }, label);
}

// ===========================================================================
// SEARCH — debounced live search
// ===========================================================================
function renderSearch() {
  const wrap = h('div', { class: 'spring-up', style: { paddingTop: '48px', paddingBottom: '140px', minHeight: '100vh' } });
  wrap.append(h('h1', { class: 'font-orb', style: { fontSize: '28px', fontWeight: 900, margin: '0 16px 16px', padding: '0 8px' } }, 'Search'));

  const inputWrap = h('div', {
    class: 'glass',
    style: { margin: '0 16px 16px', padding: '14px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.1)' },
  },
    I('search', 18, { style: 'color:rgba(255,255,255,0.4)' }),
  );
  const input = h('input', {
    type: 'text',
    placeholder: 'Search any game...',
    style: { flex: 1, background: 'transparent', border: 'none', color: 'white', fontSize: '14px' },
    onInput: (e) => { state.search.q = e.target.value; doSearch(); },
  });
  inputWrap.append(input);
  wrap.append(inputWrap);

  const results = h('div', { id: 'search-results', style: { padding: '0 16px' } });
  wrap.append(results);

  setTimeout(() => input.focus(), 100);
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
    results.append(
      h('div', { style: { textAlign: 'center', padding: '40px 0' } },
        I('crosshair', 48, { style: 'color:rgba(255,255,255,0.1)' }),
        h('p', { style: { color: 'rgba(255,255,255,0.3)', fontSize: '14px', margin: '16px 0 0' } }, 'Start typing to search millions of games'),
      ),
    );
    return;
  }

  searchDebounce = setTimeout(async () => {
    results.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      results.append(h('div', { class: 'glass', style: { marginBottom: '12px', padding: '12px', borderRadius: '20px', display: 'flex', gap: '12px' } },
        h('div', { class: 'skeleton', style: { width: '80px', height: '80px', borderRadius: '12px', flexShrink: 0 } }),
        h('div', { style: { flex: 1 } },
          h('div', { class: 'skeleton', style: { height: '14px', marginBottom: '8px' } }),
          h('div', { class: 'skeleton', style: { height: '10px', width: '50%' } }))));
    }
    try {
      const games = await API.searchGames(state.search.q);
      results.innerHTML = '';
      if (!games.length) {
        results.append(h('div', { style: { textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)' } },
          I('alert', 40, { style: 'color:rgba(255,255,255,0.2)' }),
          h('p', { style: { marginTop: '12px' } }, `No results for "${state.search.q}"`)));
        return;
      }
      games.forEach((g, i) => {
        results.append(h('div', {
          class: 'glass bounce',
          style: { marginBottom: '12px', padding: '12px', borderRadius: '20px', display: 'flex', gap: '12px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)', animation: `fadeIn 0.3s ${i * 30}ms ease backwards` },
          onClick: () => { vib(30); state.activeGame = g; state.mode = 'detail'; render(); },
        },
          h('div', { style: { width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0 } },
            g.background_image
              ? h('img', { src: g.background_image, style: { width: '100%', height: '100%', objectFit: 'cover' }, loading: 'lazy' })
              : h('div', { class: 'skeleton', style: { width: '100%', height: '100%' } })),
          h('div', { style: { flex: 1, minWidth: 0 } },
            h('h3', { class: 'line-clamp-1', style: { fontSize: '14px', fontWeight: 700, margin: 0 } }, g.name),
            h('p', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 8px' } }, (g.genres || []).map(x => x.name).join(', ') || '—'),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, I('star', 10, { style: 'color:var(--gold); fill:var(--gold)' }), h('span', { style: { fontSize: '12px', fontWeight: 700, color: 'var(--gold)' } }, g.rating?.toFixed(1) || '—')),
              g.metacritic ? h('span', { style: { fontSize: '12px', fontWeight: 700, color: 'var(--cyan)' } }, `MC ${g.metacritic}`) : null,
              g.released ? h('span', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.3)' } }, g.released.slice(0, 4)) : null,
            )),
          I('chevronRight', 16, { style: 'color:rgba(255,255,255,0.2); align-self:center' }),
        ));
      });
    } catch (e) {
      results.innerHTML = `<div style="text-align:center;padding:40px 0;color:rgba(255,255,255,0.4);">Search failed. ${e.message}</div>`;
    }
  }, 400);
}

// ===========================================================================
// RANKINGS — podium + sorted list
// ===========================================================================
function renderRankings() {
  if (!state.rankingsTab) state.rankingsTab = 'rating';
  const wrap = h('div', { class: 'spring-up', style: { paddingTop: '48px', paddingBottom: '140px', minHeight: '100vh' } });
  wrap.append(h('div', { style: { padding: '0 24px', marginBottom: '24px' } },
    h('h1', { class: 'font-orb', style: { fontSize: '28px', fontWeight: 900, margin: 0 } }, 'Rankings'),
    h('p', { style: { color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '4px 0 0' } }, 'The greatest games of all time'),
  ));

  const tabs = [
    { id: 'rating',     label: 'Rating' },
    { id: 'metacritic', label: 'Metacritic' },
    { id: 'reviews',    label: 'Reviews' },
  ];
  wrap.append(h('div', { class: 'hide-scroll', style: { display: 'flex', gap: '8px', padding: '0 24px 20px', overflowX: 'auto' } },
    ...tabs.map(t => filterPill(t.label, state.rankingsTab === t.id, () => { vib(); state.rankingsTab = t.id; render(); })),
  ));

  const sorted = [...(state.games.top || [])].sort((a, b) => {
    if (state.rankingsTab === 'rating')     return (b.rating || 0) - (a.rating || 0);
    if (state.rankingsTab === 'metacritic') return (b.metacritic || 0) - (a.metacritic || 0);
    return (b.ratings_count || 0) - (a.ratings_count || 0);
  });

  if (sorted.length >= 3) {
    const podium = h('div', { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '12px', padding: '0 24px', marginBottom: '24px', height: '180px' } });
    [1, 0, 2].forEach(idx => {
      const game = sorted[idx];
      const rank = idx + 1;
      const heights = [80, 112, 56];
      const sizes  = [64, 80, 56];
      podium.append(h('div', {
        class: 'bounce',
        style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', marginBottom: rank === 1 ? '-16px' : '0' },
        onClick: () => { vib(30); state.activeGame = game; state.mode = 'detail'; render(); },
      },
        h('div', {
          class: rank === 1 ? 'float' : '',
          style: {
            width: `${sizes[rank-1]}px`, height: `${sizes[rank-1]}px`,
            borderRadius: '20px', overflow: 'hidden',
            border: `2px solid ${rank === 1 ? 'var(--gold)' : rank === 2 ? '#c0c0c0' : '#cd7f32'}`,
            boxShadow: `0 0 ${rank === 1 ? 20 : 15}px ${rank === 1 ? 'var(--gold)' : rank === 2 ? '#c0c0c0' : '#cd7f32'}`,
            marginBottom: '8px',
          },
        },
          h('img', { src: game.background_image, style: { width: '100%', height: '100%', objectFit: 'cover' } })),
        h('p', { class: 'line-clamp-1 font-orb', style: { fontSize: '10px', fontWeight: 900, color: rank === 1 ? 'white' : 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: '90%' } }, game.name),
        h('div', {
          class: 'glass',
          style: {
            width: '100%', height: `${heights[rank-1]}px`, borderRadius: '16px 16px 0 0', marginTop: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${rank === 1 ? 'rgba(255,215,0,0.4)' : rank === 2 ? 'rgba(192,192,192,0.3)' : 'rgba(205,127,50,0.3)'}`,
            borderBottom: 'none',
          },
        },
          h('span', { class: `font-orb rank-${rank}`, style: { fontSize: rank === 1 ? '36px' : rank === 2 ? '28px' : '22px', fontWeight: 900 } }, String(rank))),
      ));
    });
    wrap.append(podium);
  }

  const list = h('div', { style: { padding: '0 16px' } });
  sorted.slice(3).forEach((game, i) => {
    list.append(h('div', {
      class: 'glass bounce',
      style: { marginBottom: '8px', padding: '12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' },
      onClick: () => { vib(30); state.activeGame = game; state.mode = 'detail'; render(); },
    },
      h('span', { class: 'font-orb', style: { width: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontWeight: 900, flexShrink: 0 } }, String(i + 4)),
      h('div', { style: { width: '56px', height: '56px', borderRadius: '14px', overflow: 'hidden', flexShrink: 0 } },
        game.background_image
          ? h('img', { src: game.background_image, style: { width: '100%', height: '100%', objectFit: 'cover' }, loading: 'lazy' })
          : h('div', { class: 'skeleton', style: { width: '100%', height: '100%' } })),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('h3', { class: 'line-clamp-1', style: { fontSize: '14px', fontWeight: 700, margin: 0 } }, game.name),
        h('p', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' } }, game.genres?.[0]?.name || '')),
      h('div', { style: { textAlign: 'right', flexShrink: 0 } },
        h('p', { class: 'font-orb', style: { color: 'var(--gold)', fontSize: '14px', fontWeight: 900, margin: 0 } },
          state.rankingsTab === 'metacritic' ? (game.metacritic || '—') : (game.rating?.toFixed(1) || '—')),
        h('p', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.3)', margin: '2px 0 0', textTransform: 'uppercase' } },
          state.rankingsTab === 'metacritic' ? 'MC' : '/ 5')),
    ));
  });
  wrap.append(list);

  if (!sorted.length) {
    wrap.append(h('div', { style: { textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.4)' } },
      h('p', null, 'No games loaded yet — check your connection and reload.')));
  }
  return wrap;
}

// ===========================================================================
// VAULT — your collection with status, ratings, notes
// ===========================================================================
function renderVault() {
  if (!state.vaultFilter) state.vaultFilter = 'all';
  const vault = Store.getState().vault;
  const status = Store.getState().status;
  const ratings = Store.getState().ratings;

  const wrap = h('div', { class: 'spring-up', style: { paddingTop: '48px', paddingBottom: '140px', padding: '48px 16px 140px', minHeight: '100vh' } });
  wrap.append(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', padding: '0 8px' } },
    h('div', null,
      h('h1', { class: 'font-orb', style: { fontSize: '28px', fontWeight: 900, margin: 0 } }, 'My Vault'),
      h('p', { style: { color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '4px 0 0' } }, `${vault.length} games tracked`)),
    h('button', {
      class: 'glass bounce',
      style: { padding: '8px 16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--cyan)', fontWeight: 700, fontSize: '13px', border: '1px solid var(--cyan)' },
      onClick: () => { vib(); state.showImport = true; render(); },
    }, I('upload', 14), 'Inject'),
  ));

  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'backlog', label: 'Backlog' },
    { id: 'playing', label: 'Playing' },
    { id: 'played',  label: 'Played' },
    { id: 'dropped', label: 'Dropped' },
  ];
  wrap.append(h('div', { class: 'hide-scroll', style: { display: 'flex', gap: '8px', marginBottom: '16px', padding: '0 8px', overflowX: 'auto' } },
    ...FILTERS.map(f => filterPill(f.label, state.vaultFilter === f.id, () => { vib(); state.vaultFilter = f.id; render(); })),
  ));

  const filtered = vault.filter(g => state.vaultFilter === 'all' || (status[g.id] || 'backlog') === state.vaultFilter);

  if (!filtered.length) {
    wrap.append(h('div', { style: { textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.3)' } },
      I('library', 40, { style: 'color:rgba(255,255,255,0.2)' }),
      h('p', { style: { marginTop: '12px', fontSize: '14px' } }, vault.length ? 'No games match this filter.' : 'Vault empty. Add games from search, or inject a list.'),
      h('button', {
        class: 'bounce',
        style: { marginTop: '20px', padding: '12px 24px', borderRadius: '20px', background: 'var(--cyan)', color: '#000', fontWeight: 900 },
        onClick: () => { vib(); state.showImport = true; render(); },
      }, 'Add Games'),
    ));
    return wrap;
  }

  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' } });
  filtered.forEach(game => {
    const s = status[game.id] || 'backlog';
    const r = ratings[game.id] || {};
    const statusColors = { backlog: 'var(--cyan)', playing: 'var(--green)', played: 'var(--purple)', dropped: 'rgba(255,255,255,0.4)' };
    const statusLabel  = { backlog: 'Backlog', playing: 'Playing', played: 'Played', dropped: 'Dropped' };

    grid.append(h('div', {
      class: 'glass bounce',
      style: { borderRadius: '32px', overflow: 'hidden', position: 'relative', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' },
      onClick: () => { vib(30); state.activeGame = game; state.mode = 'detail'; render(); },
    },
      h('div', { style: { position: 'absolute', top: 0, right: 0, padding: '4px 10px', background: statusColors[s], color: '#000', fontSize: '9px', fontWeight: 900, borderBottomLeftRadius: '12px', zIndex: 5, textTransform: 'uppercase', letterSpacing: '0.1em' } }, statusLabel[s]),
      h('div', { style: { aspectRatio: '4/3', position: 'relative' } },
        game.background_image
          ? h('img', { src: game.background_image, style: { width: '100%', height: '100%', objectFit: 'cover' }, loading: 'lazy',
              onError: (e) => { e.target.style.opacity = '0.2'; } })
          : h('div', { class: 'skeleton', style: { width: '100%', height: '100%' } }),
        h('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' } }),
        h('button', {
          style: { position: 'absolute', bottom: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 },
          onClick: (e) => { e.stopPropagation(); vib(40); Store.removeFromVault(game.id); render(); toast('Removed from vault'); },
        }, I('trash', 12, { style: 'color:rgba(255,255,255,0.7)' })),
      ),
      h('div', { style: { padding: '12px' } },
        h('h3', { class: 'line-clamp-1', style: { fontSize: '13px', fontWeight: 700, margin: 0 } }, game.name),
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' } },
          r.rating
            ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
                I('star', 9, { style: 'color:var(--gold); fill:var(--gold)' }),
                h('span', { style: { fontSize: '10px', fontWeight: 700, color: 'var(--gold)' } }, `${r.rating}/10`))
            : h('span', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.3)' } }, 'No rating'),
          r.notes ? h('span', { style: { fontSize: '10px', color: 'var(--cyan)' } }, '📝') : null,
        ))),
    );
  });
  wrap.append(grid);
  return wrap;
}

// ===========================================================================
// PROFILE — neural ID, stats, integrations, deals
// ===========================================================================
function renderProfile() {
  const s = Store.getState();
  const vault = s.vault;
  const wishlist = s.wishlist;
  const avgRating = vault.reduce((a, g) => a + (s.ratings[g.id]?.rating || 0), 0) / Math.max(1, vault.length);
  const level = Math.max(1, Math.floor(vault.length * 2.5) + 5);
  const xp = (vault.length * 47) % 1000;
  const steamConnected = !!s.settings.steamId;

  const wrap = h('div', { class: 'spring-up', style: { paddingTop: '48px', paddingBottom: '140px', padding: '48px 24px 140px', minHeight: '100vh' } });
  wrap.append(h('h1', { class: 'font-orb', style: { fontSize: '28px', fontWeight: 900, margin: 0 } }, 'Neural ID'),
             h('p', { style: { color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '4px 0 24px' } }, 'Your gaming identity'));

  // level card
  wrap.append(h('div', {
    class: `glass ${steamConnected ? 'pulse-glow' : ''}`,
    style: { padding: '24px', borderRadius: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', position: 'relative', overflow: 'hidden', border: steamConnected ? '1px solid rgba(0,240,255,0.5)' : '1px solid rgba(255,255,255,0.08)' },
  },
    steamConnected ? h('div', { class: 'scan-line', style: { opacity: 0.3 } }) : null,
    h('div', {
      class: steamConnected ? 'neon-c' : 'glass',
      style: { width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.1)' },
    }, I('trophy', 36, { style: `color:${steamConnected ? 'var(--cyan)' : 'rgba(255,255,255,0.4)'}` })),
    h('h2', { class: 'font-orb', style: { fontSize: '36px', fontWeight: 900, margin: 0 } }, `LVL ${level}`),
    h('p', { style: { color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '4px 0 16px', textAlign: 'center' } },
      steamConnected ? '⚡ Steam Synergy Active!' : 'Connect Steam for a Synergy Boost'),
    h('div', { style: { width: '100%' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' } },
        h('span', null, `${xp} XP`), h('span', null, '1000 XP')),
      h('div', { style: { width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden' } },
        h('div', { style: { width: `${xp / 10}%`, height: '100%', background: steamConnected ? 'var(--cyan)' : 'var(--purple)', transition: 'all 1s' } }))),
  ));

  // stat tiles
  const stats = [
    { label: 'Games',    value: vault.length,                                     icon: 'gamepad', color: 'var(--cyan)' },
    { label: 'Wishlist', value: wishlist.length,                                  icon: 'heart',   color: 'var(--pink)' },
    { label: 'Avg',      value: avgRating ? avgRating.toFixed(1) : '—',           icon: 'star',    color: 'var(--gold)' },
  ];
  wrap.append(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' } },
    ...stats.map(s => h('div', { class: 'glass', style: { padding: '16px', borderRadius: '24px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' } },
      h(s.icon === 'gamepad' ? 'div' : 'div', { style: { display: 'flex', justifyContent: 'center' } }, I(s.icon, 18, { style: `color:${s.color}; margin-bottom:8px` })),
      h('p', { class: 'font-orb', style: { fontSize: '18px', fontWeight: 900, margin: '8px 0 0' } }, String(s.value)),
      h('p', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.1em' } }, s.label),
    )),
  ));

  // integrations
  wrap.append(h('h3', { style: { fontSize: '16px', fontWeight: 700, margin: '0 0 12px' } }, 'Integrations'),
    h('div', { class: 'glass', style: { padding: '16px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.05)' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
        h('div', { style: { width: '48px', height: '48px', borderRadius: '50%', background: '#1b2838', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' } },
          I('gamepad', 20, { style: 'color:white' })),
        h('div', null,
          h('h4', { style: { fontSize: '14px', fontWeight: 700, margin: 0 } }, 'Steam'),
          h('p', { style: { fontSize: '11px', fontWeight: 700, color: steamConnected ? 'var(--cyan)' : 'rgba(255,255,255,0.3)', margin: '2px 0 0' } },
            steamConnected ? `✓ ${vault.filter(g => g.source === 'steam').length} games imported` : 'Not connected'))),
      h('button', {
        class: 'bounce',
        style: {
          padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
          background: steamConnected ? 'var(--glass)' : 'var(--cyan)', color: steamConnected ? 'white' : '#000',
          border: steamConnected ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--cyan)',
          boxShadow: steamConnected ? 'none' : '0 0 15px var(--cyan)',
        },
        onClick: () => { vib(); state.showSteam = true; render(); },
      }, steamConnected ? 'Manage' : 'Connect'),
    ),
  );

  // deals panel
  wrap.append(h('h3', { style: { fontSize: '16px', fontWeight: 700, margin: '24px 0 12px' } }, 'Top Deals'));
  wrap.append(h('div', { id: 'deals-panel' },
    ...Array(3).fill(0).map(() => h('div', { class: 'glass', style: { padding: '12px', borderRadius: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' } },
      h('div', { class: 'skeleton', style: { width: '48px', height: '48px', borderRadius: '8px', flexShrink: 0 } }),
      h('div', { style: { flex: 1 } },
        h('div', { class: 'skeleton', style: { height: '12px', marginBottom: '6px' } }),
        h('div', { class: 'skeleton', style: { height: '10px', width: '60%' } }))))));

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
      panel.append(h('div', { class: 'glass', style: { padding: '12px', borderRadius: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.05)' } },
        h('img', { src: d.thumb, style: { width: '64px', height: '32px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }, loading: 'lazy', onError: (e) => { e.target.style.display = 'none'; } }),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('h4', { class: 'line-clamp-1', style: { fontSize: '12px', fontWeight: 700, margin: 0 } }, d.title),
          h('p', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' } },
            h('span', { style: { color: 'var(--green)', fontWeight: 700 } }, `$${d.salePrice}`),
            ' · was ',
            h('span', { style: { textDecoration: 'line-through' } }, `$${d.normalPrice}`))),
        h('a', {
          href: `https://www.cheapshark.com/redirect?dealID=${d.dealID}`,
          target: '_blank', rel: 'noopener',
          class: 'bounce',
          style: { padding: '6px 12px', borderRadius: '8px', background: 'var(--green)', color: '#000', fontSize: '11px', fontWeight: 900, textDecoration: 'none', flexShrink: 0 },
        }, `-${savings}%`),
      ));
    });
  } catch (e) {
    panel.innerHTML = `<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.4);font-size:13px;">Deals unavailable right now.</div>`;
  }
}

// ===========================================================================
// GAME DETAIL — full info, screenshots, status, AI review
// ===========================================================================
function renderGameDetail(game) {
  const wrap = h('div', { class: 'spring-up', style: { position: 'fixed', inset: 0, zIndex: 50, background: '#050505', display: 'flex', flexDirection: 'column', overflow: 'hidden' } });

  // hero image
  wrap.append(h('div', { style: { position: 'relative', height: '38vh', width: '100%', flexShrink: 0 } },
    h('img', { src: game.background_image, style: { width: '100%', height: '100%', objectFit: 'cover' },
      onError: (e) => { e.target.style.display = 'none'; } }),
    h('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(to top, #050505, rgba(5,5,5,0.4), transparent)' } }),
    h('button', {
      class: 'glass bounce', style: { position: 'absolute', top: '40px', left: '16px', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      onClick: () => { vib(); state.activeGame = null; state.mode = null; render(); },
    }, I('chevronLeft', 24)),
    h('button', {
      class: 'glass bounce',
      style: { position: 'absolute', top: '40px', right: '16px', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      onClick: () => { vib(40); Store.toggleWishlist(game); toast(Store.inWishlist(game.id) ? 'Added to wishlist ♥' : 'Removed from wishlist'); render(); },
    }, I('heart', 20, { style: `color:${Store.inWishlist(game.id) ? 'var(--pink)' : 'rgba(255,255,255,0.6)'}; fill:${Store.inWishlist(game.id) ? 'var(--pink)' : 'none'}` })),
  ));

  // body
  const body = h('div', {
    class: 'glass hide-scroll',
    style: { flex: 1, overflowY: 'auto', marginTop: '-32px', position: 'relative', zIndex: 5, borderRadius: '40px 40px 0 0', padding: '24px', paddingBottom: '120px', borderTop: '1px solid rgba(255,255,255,0.1)' },
  });

  // title row
  const titleRow = h('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' } });
  titleRow.append(h('h1', { class: 'font-orb', style: { fontSize: '24px', fontWeight: 900, margin: 0, flex: 1, marginRight: '16px', lineHeight: 1.2 } }, game.name));
  if (game.metacritic) {
    const color = game.metacritic >= 80 ? 'var(--green)' : game.metacritic >= 60 ? 'var(--gold)' : 'var(--pink)';
    titleRow.append(h('div', { style: { flexShrink: 0, width: '56px', height: '56px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid ${color}`, color } },
      h('span', { class: 'font-orb', style: { fontSize: '18px', fontWeight: 900, lineHeight: 1 } }, String(game.metacritic)),
      h('span', { style: { fontSize: '8px', opacity: 0.6, marginTop: '2px' } }, 'MC')));
  }
  body.append(titleRow);

  // genres
  if (game.genres?.length) {
    body.append(h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px', marginTop: '8px' } },
      ...game.genres.map(g => h('span', { class: 'glass', style: { padding: '4px 12px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, color: 'var(--cyan)', border: '1px solid rgba(0,240,255,0.3)' } }, g.name))));
  }

  // stat tiles
  const stats = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' } });
  const rating = game.rating?.toFixed(1) || '—';
  stats.append(statTile('star', rating, 'Rating', 'var(--gold)'));
  stats.append(statTile('list', (game.ratings_count || 0).toLocaleString() || '—', 'Reviews'));
  stats.append(statTile('clock', game.released?.slice(0, 4) || '—', 'Released'));
  body.append(stats);

  // about
  if (game.description_raw) {
    body.append(h('h3', { style: { fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' } }, 'About'),
      h('p', { class: 'line-clamp-3', style: { fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, margin: 0, marginBottom: '20px' } }, game.description_raw));
  }

  // screenshots
  if (game._screenshots?.length) {
    body.append(h('h3', { style: { fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' } }, 'Screenshots'),
      h('div', { class: 'hide-scroll', style: { display: 'flex', gap: '12px', overflowX: 'auto', marginBottom: '20px' } },
        ...game._screenshots.map(s => h('div', { style: { minWidth: '200px', height: '110px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0 } },
          h('img', { src: s.image, style: { width: '100%', height: '100%', objectFit: 'cover' }, loading: 'lazy' })))));
  }

  // platforms
  if (game._platforms?.length) {
    body.append(h('h3', { style: { fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' } }, 'Available On'),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' } },
        ...game._platforms.map(p => h('span', { class: 'glass', style: { padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' } }, p))));
  }

  // AI review
  body.append(renderAIReview(game));

  // status + rating + notes — interactive
  body.append(renderPersonalSection(game));

  // deal + add to vault actions
  body.append(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '24px' } },
    h('button', {
      class: 'bounce',
      style: { padding: '14px', borderRadius: '20px', background: 'var(--pink)', color: 'white', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 0 25px var(--pink)' },
      onClick: () => { vib(50); state.mode = 'stream'; render(); },
    }, I('play', 16, { style: 'color:white' }), 'Watch Streams'),
    h('button', {
      class: 'bounce',
      style: { padding: '14px', borderRadius: '20px', background: Store.inVault(game.id) ? 'var(--cyan)' : 'var(--glass)', color: Store.inVault(game.id) ? '#000' : 'white', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: Store.inVault(game.id) ? '1px solid var(--cyan)' : '1px solid rgba(255,255,255,0.1)' },
      onClick: () => {
        vib(30);
        if (Store.inVault(game.id)) Store.removeFromVault(game.id);
        else Store.addToVault(game);
        toast(Store.inVault(game.id) ? 'Added to vault ✓' : 'Removed from vault');
        render();
      },
    }, Store.inVault(game.id) ? I('check', 16) : I('plus', 16), Store.inVault(game.id) ? 'In Vault' : 'Add to Vault'),
  ));

  // deals for this game
  const dealsBox = h('div', { id: 'game-deals' });
  body.append(dealsBox);
  loadGameDeals(game);

  wrap.append(body);

  // kick off async loads
  if (!game._details_loaded) loadGameExtras(game);

  return wrap;
}

function statTile(icon, value, label, color = 'white') {
  return h('div', { class: 'glass', style: { padding: '12px', borderRadius: '20px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' } },
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' } },
      I(icon, 12, { style: `color:${color}; ${color === 'var(--gold)' ? 'fill:var(--gold)' : ''}` }),
      h('span', { class: 'font-orb', style: { fontSize: '14px', fontWeight: 900 } }, String(value))),
    h('p', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' } }, label));
}

function renderAIReview(game) {
  const box = h('div', { class: 'glass', style: { padding: '16px', borderRadius: '20px', marginBottom: '20px', border: '1px solid rgba(112,0,255,0.3)' } },
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        I('bot', 16, { style: 'color:var(--purple)' }),
        h('span', { style: { fontSize: '14px', fontWeight: 700 } }, 'NexusAI Review')),
      h('button', {
        id: 'ai-generate-btn',
        class: 'bounce',
        style: { padding: '6px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: 'var(--purple)', background: 'var(--glass)', border: '1px solid rgba(112,0,255,0.4)' },
        onClick: async () => {
          const btn = document.getElementById('ai-generate-btn');
          const out = document.getElementById('ai-output');
          btn.disabled = true;
          btn.textContent = 'Thinking...';
          out.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:rgba(255,255,255,0.4);font-size:12px;"><div class="spinner"></div>Analyzing ${game.name}...</div>`;
          const res = await API.askAI(`Give a punchy 2-sentence expert review of the video game "${game.name}" (rating ${game.rating || '?'}/5, Metacritic ${game.metacritic || 'N/A'}). Be specific and opinionated.`);
          out.innerHTML = '';
          out.append(h('p', { style: { fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, margin: 0 } }, res.text));
          if (res.source === 'local') out.append(h('p', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '8px' } }, '(curated fallback — free AI is rate-limited right now)'));
          btn.style.display = 'none';
        },
      }, 'Generate')),
    h('div', { id: 'ai-output' },
      h('p', { style: { fontSize: '12px', color: 'rgba(255,255,255,0.3)', margin: 0 } }, 'Tap Generate for an AI-powered expert take'),
    ),
  );
  return box;
}

function renderPersonalSection(game) {
  const status = Store.getStatus(game.id);
  const entry = Store.getEntry(game.id);
  const STATUSES = [
    { id: 'backlog', label: 'Backlog', color: 'var(--cyan)' },
    { id: 'playing', label: 'Playing', color: 'var(--green)' },
    { id: 'played',  label: 'Played',  color: 'var(--purple)' },
    { id: 'dropped', label: 'Dropped', color: 'rgba(255,255,255,0.4)' },
  ];

  return h('div', { class: 'glass', style: { padding: '16px', borderRadius: '20px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)' } },
    h('h3', { style: { fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' } }, 'Status'),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' } },
      ...STATUSES.map(s => h('button', {
        class: 'bounce',
        style: {
          padding: '8px 14px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
          background: status === s.id ? s.color : 'var(--glass)',
          color: status === s.id ? '#000' : 'rgba(255,255,255,0.6)',
          border: status === s.id ? `1px solid ${s.color}` : '1px solid rgba(255,255,255,0.1)',
        },
        onClick: () => { vib(); Store.setStatus(game.id, s.id); if (!Store.inVault(game.id)) Store.addToVault({ id: game.id, name: game.name, background_image: game.background_image }); render(); },
      }, s.label))),

    h('h3', { style: { fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' } }, `Your Rating: ${entry.rating || '—'}/10`),
    h('div', { style: { display: 'flex', gap: '4px', marginBottom: '16px' } },
      ...Array(10).fill(0).map((_, i) => h('button', {
        class: 'bounce',
        style: { width: '28px', height: '28px', borderRadius: '6px', background: (entry.rating || 0) > i ? 'var(--gold)' : 'var(--glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900, color: (entry.rating || 0) > i ? '#000' : 'rgba(255,255,255,0.4)' },
        onClick: () => { vib(); Store.setRating(game.id, i + 1); render(); },
      }, String(i + 1)))),

    h('h3', { style: { fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' } }, 'Notes'),
    h('textarea', {
      placeholder: 'Your thoughts on this game...',
      value: entry.notes || '',
      style: { width: '100%', minHeight: '80px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: 'white', fontSize: '13px', resize: 'vertical' },
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
    if (!results.length) { box.innerHTML = ''; return; }
    const cs = results[0];
    const deals = await API.gameDeals(cs.gameID);
    if (!deals.deals?.length) return;
    const best = deals.deals.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
    const savings = parseFloat(best.savings).toFixed(0);

    box.append(h('h3', { style: { fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' } }, 'Best Price'),
      h('a', {
        href: `https://www.cheapshark.com/redirect?dealID=${best.dealID}`, target: '_blank', rel: 'noopener',
        class: 'glass bounce',
        style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '16px', border: '1px solid rgba(0,255,136,0.3)', textDecoration: 'none', marginTop: '8px' },
      },
        h('div', { style: { flex: 1 } },
          h('p', { style: { fontSize: '13px', fontWeight: 700, color: 'white', margin: 0 } }, best.storeName),
          h('p', { style: { fontSize: '16px', fontWeight: 900, color: 'var(--green)', margin: '4px 0 0' } },
            `$${best.price}`,
            h('span', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through', marginLeft: '8px' } }, `$${best.retailPrice}`))),
        h('div', { style: { padding: '6px 12px', borderRadius: '8px', background: 'var(--green)', color: '#000', fontSize: '12px', fontWeight: 900 } }, `-${savings}%`)));
  } catch (e) { /* silent */ }
}

// ===========================================================================
// STREAM MODAL — real Twitch embeds keyed to the game
// ===========================================================================
function renderStreamModal(game) {
  const wrap = h('div', { class: 'spring-up', style: { position: 'fixed', inset: 0, zIndex: 50, background: '#050505', display: 'flex', flexDirection: 'column' } });

  // top bar
  const top = h('div', { class: 'glass', style: { padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 } },
    h('button', { class: 'bounce', style: { width: '40px', height: '40px', borderRadius: '50%', background: 'var(--glass)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      onClick: () => { vib(); state.activeGame = null; state.mode = null; render(); } }, I('chevronLeft', 20)),
    h('div', null,
      h('h2', { class: 'font-orb', style: { fontSize: '16px', fontWeight: 900, margin: 0 } }, 'Live Streams'),
      h('p', { style: { fontSize: '10px', color: 'var(--cyan)', margin: '2px 0 0' } }, game.name)),
  );
  wrap.append(top);

  // list of streams
  const list = h('div', { id: 'stream-list', style: { flex: 1, overflowY: 'auto', padding: '16px' } });
  wrap.append(list);

  // chat
  const chat = h('div', { class: 'glass', style: { height: '40vh', display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 } });
  wrap.append(chat);

  loadStreams(game, list, chat);
  return wrap;
}

async function loadStreams(game, list, chat) {
  list.innerHTML = '';
  list.append(h('p', { style: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '20px 0' } },
    h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px' } },
      h('span', { class: 'spinner' }), 'Finding live streams...')));

  let streams = await API.liveStreamsForGame(game.name, 10);
  if (!streams.length) streams = await API.liveStreamsFeatured(10); // fallback: featured streams

  list.innerHTML = '';
  if (!streams.length) {
    list.append(h('div', { style: { textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.4)' } },
      h('p', null, 'No live streams right now. Try again later, or check out the game details page.')));
    renderChatFallback(chat, game);
    return;
  }

  let currentEmbed = streams[0].user_login;
  renderStreamEmbed(chat, currentEmbed);
  list.append(h('h3', { style: { fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' } }, `${streams.length} live stream${streams.length > 1 ? 's' : ''} for "${game.name}"`));
  streams.forEach(s => {
    const thumb = s.thumbnail_url?.replace('{width}', 320).replace('{height}', 180);
    const isFirst = s.user_login === currentEmbed;
    list.append(h('div', {
      class: 'bounce',
      style: { background: isFirst ? 'var(--glass)' : 'rgba(255,255,255,0.03)', borderRadius: '16px', overflow: 'hidden', marginBottom: '12px', cursor: 'pointer', border: isFirst ? '1px solid var(--cyan)' : '1px solid rgba(255,255,255,0.05)' },
      onClick: () => { vib(); currentEmbed = s.user_login; renderStreamEmbed(chat, currentEmbed); loadStreams(game, list, chat); },
    },
      h('div', { style: { position: 'relative' } },
        thumb ? h('img', { src: thumb, style: { width: '100%', height: '180px', objectFit: 'cover', display: 'block' }, loading: 'lazy' }) : null,
        h('div', { style: { position: 'absolute', top: '8px', left: '8px', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--pink)', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 900, color: 'white' } },
          h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: 'white', animation: 'pulse-glow 2s infinite' } }), 'LIVE'),
        h('div', { style: { position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.8)', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, color: 'white' } },
          `${(s.viewer_count || 0).toLocaleString()} viewers`)),
      h('div', { style: { padding: '12px' } },
        h('h4', { class: 'line-clamp-1', style: { fontSize: '13px', fontWeight: 700, margin: 0 } }, s.title),
        h('p', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' } },
          s.user_name, ' · ', s.game_name))));
  });
}

function renderStreamEmbed(chatHost, channel) {
  chatHost.innerHTML = '';
  chatHost.append(
    h('div', { style: { position: 'relative', flex: 1, minHeight: 0 } },
      h('iframe', {
        src: API.twitchEmbedUrl(channel),
        style: { width: '100%', height: '100%', border: 'none' },
        allowFullscreen: true,
        allow: 'autoplay; fullscreen',
      })),
  );
}

function renderChatFallback(chatHost, game) {
  chatHost.innerHTML = '';
  const messages = h('div', { class: 'hide-scroll', style: { flex: 1, padding: '16px', overflowY: 'auto' } });
  chatHost.append(messages);
  const BOTS = [
    { n: 'ProGamer_Z', m: 'no way that just happened', col: '#00f0ff' },
    { n: 'StreamLurker', m: 'GG', col: '#ff007f' },
    { n: 'AlphaKnight', m: 'clip it!!! 📎', col: '#7000ff' },
    { n: 'NeonSamurai_X', m: 'POG', col: '#ffd700' },
    { n: 'VoidWalker', m: '🏆🏆🏆', col: '#00ff88' },
  ];
  function addMsg(c) {
    messages.append(h('div', { class: 'fade-in', style: { display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' } },
      h('div', { style: { width: '20px', height: '20px', borderRadius: '50%', background: c.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 900, color: '#000', flexShrink: 0 } }, c.n[0]),
      h('div', null,
        h('span', { style: { fontSize: '11px', fontWeight: 700, color: c.col } }, c.n + ' '),
        h('span', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.7)' } }, c.m))));
  }
  addMsg({ n: 'NexusBot', m: `Live chat unavailable — Twitch returned no streams for "${game.name}". Try again in a moment.`, col: 'var(--cyan)' });
  let i = 0;
  setInterval(() => addMsg(BOTS[i++ % BOTS.length]), 2500);
}

// ===========================================================================
// IMPORT MODAL — paste game titles, look up via RAWG
// ===========================================================================
function renderImportModal() {
  let text = '';
  const ta = h('textarea', {
    placeholder: 'One game title per line:\nElden Ring\nHades\nCyberpunk 2077',
    style: { width: '100%', height: '192px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '16px', color: 'white', fontSize: '13px', resize: 'none', fontFamily: 'monospace' },
    onInput: (e) => { text = e.target.value; updateCount(); },
  });
  const count = h('span', { id: 'import-count' }, '0 titles');
  const btn = h('button', {
    class: 'bounce', disabled: true,
    style: { width: '100%', marginTop: '16px', padding: '16px', borderRadius: '20px', background: 'var(--cyan)', color: '#000', fontWeight: 900, boxShadow: '0 0 20px var(--cyan)' },
    onClick: async () => {
      const titles = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (!titles.length) return;
      btn.disabled = true; btn.textContent = 'Looking up games...';
      let added = 0;
      for (const title of titles) {
        try {
          const r = await API.searchGames(title);
          if (r[0]) {
            Store.addToVault({ ...r[0], status: 'backlog' });
            added++;
          } else {
            Store.addToVault({ id: 'manual-' + Date.now() + '-' + Math.random(), name: title, background_image: null, rating: 0, status: 'backlog' });
            added++;
          }
        } catch {}
      }
      toast(`Imported ${added} game${added !== 1 ? 's' : ''}`);
      state.showImport = false; render();
    },
  }, 'Execute Import');
  function updateCount() {
    const n = text.split('\n').filter(l => l.trim()).length;
    count.textContent = `${n} title${n !== 1 ? 's' : ''}`;
    btn.disabled = n === 0;
    btn.textContent = `Execute Import (${n})`;
  }

  return h('div', { class: 'modal-backdrop', onClick: (e) => { if (e.target.classList.contains('modal-backdrop')) { state.showImport = false; render(); } } },
    h('div', { class: 'glass neon-c', style: { width: '100%', maxWidth: '500px', padding: '24px', borderRadius: '40px' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' } },
        h('h3', { class: 'font-orb', style: { fontSize: '20px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 } },
          I('terminal', 18, { style: 'color:var(--cyan)' }), 'Data Injection'),
        h('button', { class: 'bounce', style: { width: '32px', height: '32px', borderRadius: '50%', background: 'var(--glass)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
          onClick: () => { state.showImport = false; render(); } }, I('x', 14))),
      ta,
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' } },
        h('span', { style: { fontSize: '12px', color: 'rgba(255,255,255,0.4)' } }, count),
        h('span', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)' } }, 'Auto-resolved via RAWG')),
      btn,
    ),
  );
}

// ===========================================================================
// STEAM MODAL — connect via public SteamID
// ===========================================================================
function renderSteamModal() {
  let input;
  const wrap = h('div', { class: 'modal-backdrop', onClick: (e) => { if (e.target.classList.contains('modal-backdrop')) { state.showSteam = false; render(); } } },
    h('div', { class: 'glass neon-c', style: { width: '100%', maxWidth: '500px', padding: '24px', borderRadius: '40px' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' } },
        h('h3', { class: 'font-orb', style: { fontSize: '20px', fontWeight: 900, margin: 0 } }, 'Connect Steam'),
        h('button', { class: 'bounce', style: { width: '32px', height: '32px', borderRadius: '50%', background: 'var(--glass)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
          onClick: () => { state.showSteam = false; render(); } }, I('x', 14))),
      h('p', { style: { fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' } },
        'Enter your SteamID64 (find it at ',
        h('a', { href: 'https://steamid.io', target: '_blank', rel: 'noopener', style: { color: 'var(--cyan)' } }, 'steamid.io'),
        '). Your Steam profile must be set to Public for this to work.'),
      h('input', {
        ref: el => input = el,
        type: 'text',
        placeholder: 'e.g. 76561198000000000',
        style: { width: '100%', padding: '14px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '14px', fontFamily: 'monospace' },
      }),
      h('button', {
        class: 'bounce',
        style: { width: '100%', marginTop: '16px', padding: '14px', borderRadius: '16px', background: 'var(--cyan)', color: '#000', fontWeight: 900 },
        onClick: async () => {
          const sid = input.value.trim();
          if (!/^\d{17}$/.test(sid)) { toast('That doesn\'t look like a valid SteamID64'); return; }
          const btn = event.target;
          btn.disabled = true; btn.textContent = 'Importing library...';
          const games = await API.steamLibrary(sid);
          if (!games.length) { toast('No public games found. Make sure your profile is public.'); btn.disabled = false; btn.textContent = 'Try Again'; return; }
          Store.setSetting('steamId', sid);
          games.forEach(g => { if (!Store.inVault(g.id)) Store.addToVault(g); });
          toast(`Imported ${games.length} Steam games`);
          state.showSteam = false; render();
        },
      }, 'Import Library'),
    ),
  );
  setTimeout(() => input?.focus(), 100);
  return wrap;
}

// ===========================================================================
// AI MODAL — free AI chat with fallback
// ===========================================================================
function renderAIModal() {
  const messages = [
    { role: 'assistant', content: "Hey! I'm NexusAI 🎮 Ask me anything — game recommendations, what to play tonight, hidden gems, or strategy tips." },
  ];
  const list = h('div', { class: 'hide-scroll', style: { flex: 1, overflowY: 'auto', padding: '20px' } });
  const input = h('input', {
    type: 'text',
    placeholder: 'Ask NexusAI anything...',
    style: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '999px', padding: '12px 16px', color: 'white', fontSize: '14px' },
  });

  function addMessage(m) {
    messages.push(m);
    const isUser = m.role === 'user';
    const row = h('div', { class: 'fade-in', style: { display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: '16px' } });
    if (!isUser) {
      row.append(h('div', { style: { width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--purple), var(--cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '8px', flexShrink: 0, alignSelf: 'flex-end' } },
        I('bot', 14, { style: 'color:white' })));
    }
    row.append(h('div', {
      class: isUser ? '' : 'glass',
      style: {
        maxWidth: '80%', borderRadius: '20px', padding: '12px 16px', fontSize: '14px', lineHeight: 1.5,
        background: isUser ? 'var(--purple)' : 'var(--glass)',
        color: 'white',
        borderTopRightRadius: isUser ? '6px' : '20px',
        borderTopLeftRadius: isUser ? '20px' : '6px',
        border: isUser ? 'none' : '1px solid rgba(255,255,255,0.08)',
      },
    }, m.content));
    list.append(row);
    list.scrollTop = list.scrollHeight;
  }
  addMessage(messages[0]);

  // quick prompts
  const QUICK = ['What should I play tonight?', 'Best RPGs of all time?', 'Hidden indie gems?', 'Compare Elden Ring vs Dark Souls'];
  const quickRow = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' } },
    ...QUICK.map(q => h('button', {
      class: 'glass bounce', style: { padding: '12px', borderRadius: '12px', textAlign: 'left', fontSize: '12px', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' },
      onClick: () => { input.value = q; input.focus(); },
    }, q)));

  const sendBtn = h('button', {
    class: 'bounce',
    style: { width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--purple), var(--cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(112,0,255,0.4)', flexShrink: 0 },
    onClick: send,
  }, I('send', 16, { style: 'color:white' }));

  async function send() {
    const q = input.value.trim();
    if (!q) return;
    vib();
    addMessage({ role: 'user', content: q });
    input.value = '';
    sendBtn.disabled = true;

    const typing = h('div', { class: 'fade-in', style: { display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' } },
      h('div', { style: { width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--purple), var(--cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '8px', flexShrink: 0, alignSelf: 'flex-end' } }, I('bot', 14, { style: 'color:white' })),
      h('div', { class: 'glass', style: { padding: '12px 16px', borderRadius: '20px', borderTopLeftRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '6px' } },
        h('div', { style: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse-glow 1s infinite' } }),
        h('div', { style: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse-glow 1s infinite 0.2s' } }),
        h('div', { style: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse-glow 1s infinite 0.4s' } })));
    list.append(typing);
    list.scrollTop = list.scrollHeight;

    const res = await API.askAI(q);
    typing.remove();
    addMessage({ role: 'assistant', content: res.text + (res.source === 'local' ? '' : '') });
    sendBtn.disabled = false;
  }

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

  const wrap = h('div', { class: 'spring-up', style: { position: 'fixed', inset: 0, zIndex: 50, background: '#050505', display: 'flex', flexDirection: 'column' } });
  wrap.append(
    h('div', { class: 'glass', style: { padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 } },
      h('button', { class: 'bounce', style: { width: '40px', height: '40px', borderRadius: '50%', background: 'var(--glass)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        onClick: () => { state.showAI = false; render(); } }, I('chevronLeft', 20)),
      h('div', { style: { width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--purple), var(--cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, I('bot', 20, { style: 'color:white' })),
      h('div', null,
        h('h2', { class: 'font-orb', style: { fontSize: '16px', fontWeight: 900, margin: 0 } }, 'NexusAI'),
        h('p', { style: { fontSize: '10px', color: 'var(--cyan)', margin: '2px 0 0' } }, 'Gaming Intelligence · Online'))),
    list,
    h('div', { class: 'glass', style: { padding: '16px', display: 'flex', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, alignItems: 'center' } },
      input, sendBtn),
  );
  list.append(quickRow);
  setTimeout(() => list.scrollTop = 0, 50);
  return wrap;
}

// ===========================================================================
// BOOTSTRAP
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
    console.error('boot load failed:', e);
    toast('Could not reach RAWG — check your connection');
  }
  state.loading = false;
  setTimeout(() => { state.bootDone = true; render(); }, 400);
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  render();
  boot();
});
