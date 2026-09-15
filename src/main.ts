import './style.css';
import type {
  AppScreen,
  Filters,
  Outcome,
  Period,
  PlotMode,
  RinkExtent,
  SeasonStore,
  ShotEvent,
  Side,
  Strength,
  UiMode,
} from './types';
import {
  addShot,
  composeGameLabel,
  defaultFilters,
  exportSeasonJson,
  filterShots,
  formatGameLabel,
  importSeasonJson,
  loadSeason,
  periodLabel,
  removeShot,
  saveSeason,
  strengthCounts,
  strengthLabel,
  uid,
  updateShot,
  upsertGame,
  upsertPlayer,
} from './store';
import { importGameCsv, parsePlayerField, slugId } from './csv';
import { drawHeatmap } from './heatmap';
import { defenseStats, offenseStats, perGoalieDefense, perPlayerOffense } from './stats';
import { buildClipUrl, formatTimestamp, parseTimestampToSeconds } from './video';
import {
  createPlayer,
  extractYoutubeId,
  type YtPlayerHandle,
} from './youtubePlayer';

const ASSET_BASE = import.meta.env.BASE_URL || './';

type LiveActionKind = 'our_shot' | 'our_goal' | 'opp_shot' | 'opp_goal';

type LivePending = {
  side: Side;
  outcome: Outcome;
  strength: Strength;
  videoTimestampSec: number;
  period: Period;
  kind: LiveActionKind;
};

const ACTIVE_GAME_KEY = 'shotsheet-active-game';

const app = document.querySelector<HTMLDivElement>('#app')!;

let season: SeasonStore = loadSeason();
let filters: Filters = defaultFilters();
let plotMode: PlotMode = 'our_shot';
let uiMode: UiMode = 'place';
/** Sticky period for Place mode */
let plotPeriod: Period = 1;
/** Sticky strength for Place mode (default EV) */
let plotStrength: Strength = 'EV';
let placingShotId: string | null = null;
let selectedShotId: string | null = null;
/** When set, next rink click relocates this shot (Review edit) */
let relocatingShotId: string | null = null;
/** Review-mode inline edit expanded */
let reviewEditing = false;
let showHeatmap = true;
/** Place: default hidden; Review: default on — applied on mode switch */
let showMarkers = false;
let rinkExtent: RinkExtent = 'half';
/** When true: show other end + mirror so attack direction stays consistent */
let attackFlip = false;
/** Chart Settings modal (opponent / date / location / film) */
let settingsOpen = false;
/** Stacked picker candidates when Review click hits overlapping markers */
let stackPicker: ShotEvent[] | null = null;
let toastTimer: number | undefined;
let screen: AppScreen = 'home';
let activeGameId: string | null = null;

/** Live mark: pending placement after YT stamp */
let livePending: LivePending | null = null;
/** Rewind 4s before stamp (default ON) */
let liveRewind4s = true;
let lastLiveAction: LiveActionKind = 'our_shot';
let ytPlayer: YtPlayerHandle | null = null;
let ytBoundVideoId: string | null = null;
let ytSavedTime = 0;
let ytWantPaused = false;
let ytErrorMsg: string | null = null;
let ytMountGen = 0;

function loadActiveGameId(): string | null {
  try {
    const id = localStorage.getItem(ACTIVE_GAME_KEY);
    if (!id) return null;
    if (!season.games.some((g) => g.id === id)) return null;
    return id;
  } catch {
    return null;
  }
}

activeGameId = loadActiveGameId();
if (activeGameId) {
  filters = { ...filters, gameId: activeGameId };
}

function setActiveGame(id: string | null) {
  activeGameId = id;
  if (id) {
    filters = { ...filters, gameId: id };
    try {
      localStorage.setItem(ACTIVE_GAME_KEY, id);
    } catch {
      /* ignore quota / private mode */
    }
  } else {
    try {
      localStorage.removeItem(ACTIVE_GAME_KEY);
    } catch {
      /* ignore */
    }
  }
}

function goto(next: AppScreen) {
  screen = next;
  settingsOpen = false;
  if (next === 'chart' && activeGameId) {
    filters = { ...filters, gameId: activeGameId };
  }
  if (next === 'reports') {
    if (!showHeatmap) showHeatmap = true;
    showMarkers = true;
  }
  render();
}

function persist() {
  saveSeason(season);
}

function toast(msg: string, kind: 'ok' | 'error' = 'ok') {
  const el = document.createElement('div');
  el.className = `toast${kind === 'error' ? ' error' : ''}`;
  el.textContent = msg;
  document.body.appendChild(el);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.remove(), 3200);
}


function liveActionMeta(kind: LiveActionKind): { side: Side; outcome: Outcome; label: string } {
  switch (kind) {
    case 'our_shot':
      return { side: 'for', outcome: 'miss', label: 'Our shot' };
    case 'our_goal':
      return { side: 'for', outcome: 'goal', label: 'Our goal' };
    case 'opp_shot':
      return { side: 'against', outcome: 'save', label: 'Opp shot' };
    case 'opp_goal':
      return { side: 'against', outcome: 'goal_against', label: 'Opp goal' };
  }
}

function getYtHost(): HTMLDivElement | null {
  return document.getElementById('yt-host') as HTMLDivElement | null;
}

/** Move host back to body before #app.innerHTML so the iframe is not destroyed by the wipe. */
function detachYtHost() {
  const host = getYtHost();
  if (!host) return;
  if (ytPlayer) {
    try {
      ytSavedTime = ytPlayer.getCurrentTime();
    } catch {
      /* ignore */
    }
  }
  if (host.parentElement !== document.body) {
    document.body.appendChild(host);
  }
}

function destroyYtPlayer() {
  try {
    ytPlayer?.destroy();
  } catch {
    /* ignore */
  }
  ytPlayer = null;
  ytBoundVideoId = null;
  const host = getYtHost();
  if (host) host.innerHTML = '';
}

function hideYtHost() {
  const host = getYtHost();
  if (!host) return;
  host.hidden = true;
  if (host.parentElement !== document.body) {
    document.body.appendChild(host);
  }
}

async function mountYtPlayerForGame(videoUrl: string | undefined) {
  const host = getYtHost();
  const slot = document.getElementById('yt-slot');
  const fallback = document.getElementById('film-fallback');
  if (!host || !slot) {
    hideYtHost();
    return;
  }

  slot.appendChild(host);

  const id = extractYoutubeId(videoUrl);
  if (!id) {
    destroyYtPlayer();
    host.hidden = true;
    ytErrorMsg = videoUrl?.trim()
      ? 'Could not parse a YouTube video id from this URL.'
      : 'No game film URL set. Add a YouTube URL in Settings.';
    if (fallback) {
      fallback.hidden = false;
      const msg = fallback.querySelector('.film-fallback-msg');
      if (msg) msg.textContent = ytErrorMsg;
    }
    return;
  }

  // Same video already bound — keep iframe, just reattach
  if (ytPlayer && ytBoundVideoId === id) {
    host.hidden = false;
    ytErrorMsg = null;
    if (fallback) fallback.hidden = true;
    if (ytWantPaused) {
      ytPlayer.pause();
      ytWantPaused = false;
    }
    return;
  }

  const gen = ++ytMountGen;
  destroyYtPlayer();
  host.hidden = false;
  if (fallback) {
    fallback.hidden = false;
    const msg = fallback.querySelector('.film-fallback-msg');
    if (msg) msg.textContent = 'Loading YouTube player…';
  }

  try {
    const player = await createPlayer(host, id, {
      origin: typeof location !== 'undefined' ? location.origin : undefined,
      onReady: (p) => {
        if (ytSavedTime > 0) p.seekTo(ytSavedTime);
        if (ytWantPaused) {
          p.pause();
          ytWantPaused = false;
        }
      },
      onError: (code) => {
        ytErrorMsg = `YouTube embed failed (error ${code}). Use Open clip instead.`;
        const fb = document.getElementById('film-fallback');
        if (fb) {
          fb.hidden = false;
          const m = fb.querySelector('.film-fallback-msg');
          if (m) m.textContent = ytErrorMsg;
        }
      },
    });
    if (gen !== ytMountGen) {
      player.destroy();
      return;
    }
    ytPlayer = player;
    ytBoundVideoId = id;
    ytErrorMsg = null;
    if (fallback) fallback.hidden = true;
  } catch (e) {
    if (gen !== ytMountGen) return;
    ytPlayer = null;
    ytBoundVideoId = null;
    ytErrorMsg = e instanceof Error ? e.message : String(e);
    host.hidden = true;
    if (fallback) {
      fallback.hidden = false;
      const msg = fallback.querySelector('.film-fallback-msg');
      if (msg) msg.textContent = ytErrorMsg + ' — use Open clip fallback.';
    }
  }
}

function captureLiveTimestamp(rewind: boolean): number | null {
  if (!ytPlayer) return null;
  try {
    ytPlayer.pause();
    let t = ytPlayer.getCurrentTime();
    if (rewind) {
      t = Math.max(0, t - 4);
      ytPlayer.seekTo(t);
    }
    ytSavedTime = t;
    ytWantPaused = true;
    return t;
  } catch {
    return null;
  }
}

function beginLiveMark(kind: LiveActionKind, forceNoRewind = false) {
  if (!activeGameId) {
    toast('Select a game first', 'error');
    return;
  }
  lastLiveAction = kind;
  const meta = liveActionMeta(kind);
  const rewind = forceNoRewind ? false : liveRewind4s;

  const strengthBtn = document.querySelector('.live-strength button.active') as HTMLElement | null;
  const st = strengthBtn?.dataset.strength;
  if (st === 'EV' || st === 'PP' || st === 'SH') plotStrength = st;
  const periodEl = document.getElementById('plot-period') as HTMLSelectElement | null;
  if (periodEl) plotPeriod = parsePeriodSelect(periodEl);

  let ts = captureLiveTimestamp(rewind);
  if (ts == null) {
    ts = 0;
    toast('Player not ready — timestamp may be 0. Set film URL or use Open clip.', 'error');
  }

  livePending = {
    side: meta.side,
    outcome: meta.outcome,
    strength: plotStrength,
    videoTimestampSec: ts,
    period: plotPeriod,
    kind,
  };
  uiMode = 'place';
  showMarkers = false;
  placingShotId = null;
  selectedShotId = null;
  relocatingShotId = null;
  reviewEditing = false;
  stackPicker = null;
  toast(`${meta.label} @ ${formatTimestamp(ts)} · ${plotStrength} · tap rink to place`);
  render();
}

function cancelLivePending() {
  livePending = null;
  ytWantPaused = false;
  render();
}

function openClipAtTime(sec: number) {
  const game = activeGameId ? gameById(activeGameId) : undefined;
  const url = buildClipUrl(game?.videoUrl, undefined, sec);
  if (!url) {
    toast('Set a game film YouTube URL first', 'error');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function setUiMode(mode: UiMode) {
  uiMode = mode;
  placingShotId = null;
  relocatingShotId = null;
  reviewEditing = false;
  stackPicker = null;
  if (mode !== 'place') livePending = null;
  // Mode defaults for markers (user can still toggle afterward)
  showMarkers = mode !== 'place';
  if (mode === 'place') selectedShotId = null;
  // Review: keep markers on (and keep selection)
  render();
}

function sortedGames() {
  return [...season.games].sort((a, b) => {
    const da = a.date || a.createdAt || '';
    const db = b.date || b.createdAt || '';
    return db.localeCompare(da);
  });
}

function gameShotCount(id: string) {
  return season.shots.filter((s) => s.gameId === id).length;
}

function skaters() {
  return season.players.filter((p) => p.role !== 'goalie');
}

function goalies() {
  const g = season.players.filter((p) => p.role === 'goalie');
  if (g.length) return g;
  const ids = new Set(season.shots.filter((s) => s.goalieId).map((s) => s.goalieId!));
  return season.players.filter((p) => ids.has(p.id));
}

function filtered(): ShotEvent[] {
  let list = filterShots(season, filters);
  if (filters.playerId !== 'all' && filters.side === 'both') {
    list = season.shots.filter(
      (s) =>
        (filters.gameId === 'all' || s.gameId === filters.gameId) &&
        (filters.period === 'all' || s.period === filters.period) &&
        (filters.strength === 'all' || (s.strength ?? 'EV') === filters.strength) &&
        (filters.outcome === 'all' || s.outcome === filters.outcome) &&
        s.side === 'for' &&
        s.playerId === filters.playerId,
    );
  }
  if (filters.goalieId !== 'all' && filters.side === 'both') {
    list = season.shots.filter(
      (s) =>
        (filters.gameId === 'all' || s.gameId === filters.gameId) &&
        (filters.period === 'all' || s.period === filters.period) &&
        (filters.strength === 'all' || (s.strength ?? 'EV') === filters.strength) &&
        (filters.outcome === 'all' || s.outcome === filters.outcome) &&
        s.side === 'against' &&
        s.goalieId === filters.goalieId,
    );
  }
  return list;
}

function playerName(id?: string) {
  if (!id) return '—';
  return season.players.find((p) => p.id === id)?.name ?? id;
}

function gameById(id: string) {
  return season.games.find((g) => g.id === id);
}

function outcomeLabel(o: Outcome) {
  switch (o) {
    case 'goal':
      return 'Goal';
    case 'miss':
      return 'Miss / on-goal';
    case 'save':
      return 'Save';
    case 'goal_against':
      return 'GA';
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function readGameMetaFromForm(): {
  opponent?: string;
  date?: string;
  location?: string;
  videoUrl?: string;
} {
  const opponent =
    (document.getElementById('game-opponent') as HTMLInputElement | null)?.value.trim() ||
    undefined;
  const date =
    (document.getElementById('game-date') as HTMLInputElement | null)?.value.trim() || undefined;
  const location =
    (document.getElementById('game-location') as HTMLInputElement | null)?.value.trim() ||
    undefined;
  const videoUrl =
    (document.getElementById('game-video') as HTMLInputElement | null)?.value.trim() || undefined;
  return { opponent, date, location, videoUrl };
}


function periodOptions(selected: Period | 'all' | undefined, includeAll: boolean): string {
  const opts: { v: string; l: string }[] = [];
  if (includeAll) opts.push({ v: 'all', l: 'All' });
  for (const p of [1, 2, 3, 'OT'] as const) {
    opts.push({ v: String(p), l: p === 'OT' ? 'OT' : String(p) });
  }
  return opts
    .map(
      (o) =>
        `<option value="${o.v}" ${String(selected ?? '') === o.v ? 'selected' : ''}>${o.l}</option>`,
    )
    .join('');
}

function strengthOptions(selected: Strength | 'all' | undefined, includeAll: boolean): string {
  const opts: { v: string; l: string }[] = [];
  if (includeAll) opts.push({ v: 'all', l: 'All' });
  for (const st of ['EV', 'PP', 'SH'] as const) {
    opts.push({ v: st, l: st });
  }
  const cur = selected ?? 'EV';
  return opts
    .map((o) => `<option value="${o.v}" ${cur === o.v ? 'selected' : ''}>${o.l}</option>`)
    .join('');
}

/** True when game has opponent/date/location or a meaningful non-empty label. */
function gameHasIdentifyingMeta(g: { opponent?: string; date?: string; location?: string; label?: string }): boolean {
  if (g.opponent?.trim()) return true;
  if (g.date?.trim()) return true;
  if (g.location?.trim()) return true;
  const lab = g.label?.trim();
  if (lab && lab !== 'Untitled game') return true;
  return false;
}

/**
 * Map click in visible wrap (0–1) → full-rink normalized coords.
 * Visual space is after CSS horizontal mirror; stored space is absolute rink image.
 */
function viewToRink(nx: number, ny: number): { x: number; y: number } {
  if (rinkExtent === 'full') {
    return {
      x: attackFlip ? 1 - nx : nx,
      y: ny,
    };
  }
  // Half: default shows attack half x∈[0.5,1]; flip shows other end mirrored
  if (!attackFlip) {
    return { x: 0.5 + nx * 0.5, y: ny };
  }
  // Mirrored left half so attack goal stays on the visual right
  return { x: 0.5 - nx * 0.5, y: ny };
}

/** Inverse of viewToRink: stored rink → visible wrap normalized (for hit-testing). */
function rinkToView(x: number, y: number): { nx: number; ny: number } {
  if (rinkExtent === 'full') {
    return { nx: attackFlip ? 1 - x : x, ny: y };
  }
  if (!attackFlip) {
    return { nx: (x - 0.5) / 0.5, ny: y };
  }
  return { nx: (0.5 - x) / 0.5, ny: y };
}

function rinkWrapClasses(): string {
  const parts = ['rink-wrap'];
  if (rinkExtent === 'half') parts.push('half');
  if (attackFlip) parts.push('flipped');
  if (screen === 'reports') parts.push('mode-reports');
  else {
    if (uiMode === 'place') parts.push('mode-place');
    if (uiMode === 'review') parts.push('mode-review');
    if (relocatingShotId) parts.push('relocating');
  }
  return parts.join(' ');
}

function outcomeOptions(selected: Outcome | 'all' | undefined, includeAll: boolean): string {
  const opts: { v: string; l: string }[] = [];
  if (includeAll) opts.push({ v: 'all', l: 'All' });
  opts.push(
    { v: 'goal', l: 'Goal' },
    { v: 'miss', l: 'Miss / on-goal' },
    { v: 'save', l: 'Save' },
    { v: 'goal_against', l: 'GA' },
  );
  return opts
    .map((o) => `<option value="${o.v}" ${String(selected ?? 'all') === o.v ? 'selected' : ''}>${o.l}</option>`)
    .join('');
}

function headerHtml(): string {
  if (screen === 'home') {
    return `
    <header class="app-header">
      <h1>ShotSheet</h1>
      <nav class="app-nav">
        <button type="button" data-screen="home" class="active">Home</button>
        <button type="button" data-screen="chart">Chart</button>
        <button type="button" data-screen="reports">Reports</button>
      </nav>
    </header>`;
  }
  const game =
    screen === 'chart' && activeGameId ? gameById(activeGameId) : undefined;
  const sub = game ? `<span class="header-game">${esc(formatGameLabel(game))}</span>` : '';
  return `
    <header class="app-header app-header-inner">
      <button type="button" class="back-home" data-screen="home" aria-label="Back to Home">←</button>
      <h1>ShotSheet</h1>
      ${sub}
    </header>`;
}

function persistButtonsHtml(): string {
  return `
            <div class="row">
              <button type="button" class="ghost" data-action="export-json">Export JSON</button>
              <label class="btn ghost" style="margin:0">Import JSON<input type="file" id="json-file" accept="application/json,.json" hidden /></label>
            </div>
            <p class="hint">Season stored in <code>localStorage</code>.</p>`;
}

function statsInnerHtml(shots: ShotEvent[]): string {
  const off = offenseStats(shots);
  const def = defenseStats(shots);
  const byStrength = strengthCounts(shots);
  return `
          <div class="stats-grid">
            <div class="stat-card"><div class="label">Shots for</div><div class="value">${off.shots}</div></div>
            <div class="stat-card"><div class="label">Goals</div><div class="value">${off.goals}</div></div>
            <div class="stat-card"><div class="label">Shooting %</div><div class="value">${off.shootingPct.toFixed(1)}%</div></div>
            <div class="stat-card"><div class="label">SA</div><div class="value">${def.shotsAgainst}</div></div>
            <div class="stat-card"><div class="label">Saves</div><div class="value">${def.saves}</div></div>
            <div class="stat-card"><div class="label">GA / Sv%</div><div class="value">${def.goalsAgainst} / ${def.savePct.toFixed(0)}%</div></div>
          </div>
          <p class="hint" style="margin-top:0.5rem">Strength (filtered): EV ${byStrength.EV} · PP ${byStrength.PP} · SH ${byStrength.SH}</p>
          <div class="breakdown" style="margin-top:0.65rem">
            <table>
              <thead><tr><th>Player</th><th>S</th><th>G</th><th>%</th></tr></thead>
              <tbody>
                ${perPlayerOffense(season, shots)
                  .map(
                    ({ player, stats: st }) =>
                      `<tr><td>${esc(player.name)}</td><td>${st.shots}</td><td>${st.goals}</td><td>${st.shootingPct.toFixed(0)}%</td></tr>`,
                  )
                  .join('') || '<tr><td colspan="4">No for shots</td></tr>'}
              </tbody>
            </table>
            <table style="margin-top:0.5rem">
              <thead><tr><th>Goalie</th><th>SA</th><th>Sv</th><th>GA</th></tr></thead>
              <tbody>
                ${perGoalieDefense(season, shots)
                  .map(
                    ({ player, stats: st }) =>
                      `<tr><td>${esc(player.name)}</td><td>${st.shotsAgainst}</td><td>${st.saves}</td><td>${st.goalsAgainst}</td></tr>`,
                  )
                  .join('') || '<tr><td colspan="4">No against shots</td></tr>'}
              </tbody>
            </table>
          </div>`;
}

function rinkBlockHtml(title: string, extraToolbar: string): string {
  const rinkTitle =
    screen === 'reports'
      ? 'Reports — heatmap overview'
      : uiMode === 'place'
        ? 'Click to place shot'
        : relocatingShotId
          ? 'Click rink to re-place shot'
          : 'Review — click marker to select';
  return `
        <div class="toolbar-rink">
          <span class="status-pill">${esc(title)}</span>
          <div class="mode-toggle compact" title="Rink view">
            <button type="button" data-action="extent" data-extent="half" class="${rinkExtent === 'half' ? 'active' : ''}">Half</button>
            <button type="button" data-action="extent" data-extent="full" class="${rinkExtent === 'full' ? 'active' : ''}">Full</button>
          </div>
          <button type="button" class="ghost ${attackFlip ? 'active-flip' : ''}" data-action="flip-attack" title="Show other end / keep attack direction">Attacking other end</button>
          <label class="row" style="gap:0.35rem;font-size:0.8rem;color:var(--muted)">
            <input type="checkbox" id="tog-heat" ${showHeatmap ? 'checked' : ''} /> Heatmap
          </label>
          <label class="row" style="gap:0.35rem;font-size:0.8rem;color:var(--muted)">
            <input type="checkbox" id="tog-markers" ${showMarkers ? 'checked' : ''} /> Show markers
          </label>
          <span class="spacer"></span>
          ${extraToolbar}
        </div>

        <div class="${rinkWrapClasses()}" id="rink-wrap" title="${rinkTitle}">
          <div class="rink-stage" id="rink-stage">
            <img class="rink" id="rink-img" src="${ASSET_BASE}rink-background.jpg" alt="Hockey rink" draggable="false" />
            <canvas class="heat" id="heat-canvas"></canvas>
            <div class="markers" id="markers"></div>
          </div>
          ${
            stackPicker && stackPicker.length > 1 && screen === 'chart'
              ? `<div class="stack-picker" id="stack-picker">
                  <div class="stack-picker-title">Overlapping shots — pick one</div>
                  ${stackPicker
                    .map((s) => {
                      const who =
                        s.side === 'for' ? playerName(s.playerId) : playerName(s.goalieId);
                      return `<button type="button" data-pick="${s.id}">${esc(outcomeLabel(s.outcome))} · ${esc(who)} · P${periodLabel(s.period)}</button>`;
                    })
                    .join('')}
                  <button type="button" class="ghost" data-action="close-picker">Cancel</button>
                </div>`
              : ''
          }
        </div>

        <div class="legend">
          <span><i class="swatch goal"></i> Goal</span>
          <span><i class="swatch miss"></i> Miss / on-goal</span>
          <span><i class="swatch save"></i> Save</span>
          <span><i class="swatch ga"></i> Goal against</span>
        </div>`;
}

function render() {
  const savedReviewScroll = document.getElementById('review-list')?.scrollTop;
  detachYtHost();
  if (screen === 'home') {
    hideYtHost();
    renderHome();
  } else if (screen === 'reports') {
    hideYtHost();
    renderReports();
  } else {
    renderChart();
  }
  bind();
  if (screen === 'chart' || screen === 'reports') {
    paintRink(filtered());
  }
  if (savedReviewScroll != null && screen === 'chart') {
    const list = document.getElementById('review-list');
    if (list) list.scrollTop = savedReviewScroll;
  }
  if (screen === 'chart' && activeGameId) {
    const g = gameById(activeGameId);
    void mountYtPlayerForGame(g?.videoUrl);
  } else {
    hideYtHost();
  }
}

function renderHome() {
  const games = sortedGames();
  app.innerHTML = `
    ${headerHtml()}
    <div class="home-layout">
      <section class="panel">
        <h2>Games</h2>
        ${
          games.length === 0
            ? '<p class="hint">No games yet. Create one to start charting shots.</p>'
            : `<div class="game-list">
              ${games
                .map((g) => {
                  const n = gameShotCount(g.id);
                  const active = g.id === activeGameId ? 'active' : '';
                  return `<button type="button" class="game-row ${active}" data-open-game="${g.id}">
                    <div class="game-row-title">${esc(formatGameLabel(g))}</div>
                    <div class="meta">${n} shot${n === 1 ? '' : 's'}</div>
                  </button>`;
                })
                .join('')}
            </div>`
        }
      </section>
      <div class="stack">
        <section class="panel">
          <h2>Create new game</h2>
          <p class="hint">Our roster is always us. Opponent is the other team only.</p>
          <div class="stack">
            <label class="field">Opponent
              <input type="text" id="create-opponent" placeholder="e.g. Rangers" />
            </label>
            <label class="field">Date
              <input type="date" id="create-date" value="${todayIso()}" />
            </label>
            <label class="field">Location
              <input type="text" id="create-location" placeholder="Rink / city" />
            </label>
            <label class="field">Film URL (YouTube)
              <input type="url" id="create-video" placeholder="https://www.youtube.com/watch?v=…" />
            </label>
            <button type="button" class="primary" data-action="create-game">Create game</button>
          </div>
        </section>
        <section class="panel">
          <h2>Season</h2>
          <div class="stack">
            ${persistButtonsHtml()}
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderChartEmpty() {
  app.innerHTML = `
    ${headerHtml()}
    <section class="panel empty-state">
      <h2>No game selected</h2>
      <p class="hint">Chart is for one game at a time. Pick a past game or create one on Home.</p>
      <div class="row">
        <button type="button" class="primary" data-screen="home">Go to Home</button>
      </div>
    </section>
  `;
}


function renderReports() {
  const shots = filtered();
  const placedCount = shots.filter((s) => s.x != null).length;
  const selectedGame = filters.gameId === 'all' ? undefined : gameById(filters.gameId);
  const gameTitle = selectedGame ? formatGameLabel(selectedGame) : 'All games';

  app.innerHTML = `
    ${headerHtml()}
    <div class="layout">
      <aside>
        <section class="panel">
          <h2>Filters</h2>
          <div class="stack">
            <label class="field">Game
              <select id="filter-game">
                <option value="all" ${filters.gameId === 'all' ? 'selected' : ''}>All games</option>
                ${sortedGames()
                  .map(
                    (g) =>
                      `<option value="${g.id}" ${filters.gameId === g.id ? 'selected' : ''}>${esc(formatGameLabel(g))}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="field">Period
              <select id="filter-period">
                ${periodOptions(filters.period, true)}
              </select>
            </label>
            <label class="field">Strength
              <select id="filter-strength">
                ${strengthOptions(filters.strength, true)}
              </select>
            </label>
            <label class="field">For / against
              <select id="filter-side">
                <option value="both" ${filters.side === 'both' ? 'selected' : ''}>Both</option>
                <option value="for" ${filters.side === 'for' ? 'selected' : ''}>For</option>
                <option value="against" ${filters.side === 'against' ? 'selected' : ''}>Against</option>
              </select>
            </label>
            <label class="field">Player (for)
              <select id="filter-player">
                <option value="all">All players</option>
                ${skaters().map((p) => `<option value="${p.id}" ${filters.playerId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
              </select>
            </label>
            <label class="field">Outcome
              <select id="filter-outcome">
                ${outcomeOptions(filters.outcome, true)}
              </select>
            </label>
          </div>
        </section>
        ${
          selectedGame
            ? `
        <section class="panel">
          <h2>This game</h2>
          <p class="game-lock">${esc(gameTitle)}</p>
          <div class="row" style="margin-top:0.65rem">
            <button type="button" class="primary" data-action="reports-open-chart">Open in Chart</button>
          </div>
        </section>
        `
            : ''
        }
      </aside>
      <main class="reports-main">
        ${rinkBlockHtml(`${placedCount} placed · ${shots.length} events · ${gameTitle}`, '')}
        <section class="panel" style="margin-top:0.85rem">
          <h2>Overview</h2>
          ${statsInnerHtml(shots)}
        </section>
      </main>
    </div>
  `;
}


function settingsModalHtml(game: { opponent?: string; date?: string; location?: string; videoUrl?: string; label?: string }): string {
  if (!settingsOpen) return '';
  return `
    <div class="settings-backdrop" data-action="close-settings" role="presentation">
      <div class="settings-modal panel" role="dialog" aria-labelledby="settings-title" data-settings-panel>
        <div class="settings-modal-head">
          <h2 id="settings-title">Settings</h2>
          <button type="button" class="ghost" data-action="close-settings" aria-label="Close">✕</button>
        </div>
        <div class="stack">
          <label class="field">Opponent
            <input type="text" id="game-opponent" placeholder="e.g. Rangers" value="${esc(game.opponent ?? '')}" />
          </label>
          <label class="field">Date
            <input type="date" id="game-date" value="${esc(game.date ?? '')}" />
          </label>
          <label class="field">Location
            <input type="text" id="game-location" placeholder="Rink / city" value="${esc(game.location ?? '')}" />
          </label>
          <label class="field">Game film URL (YouTube)
            <input type="url" id="game-video" placeholder="https://www.youtube.com/watch?v=…" value="${esc(game.videoUrl ?? '')}" />
          </label>
          <div class="row">
            <button type="button" class="primary" data-action="save-game">Save</button>
            <button type="button" class="ghost" data-action="close-settings">Cancel</button>
          </div>
        </div>
      </div>
    </div>`;
}

function renderChart() {
  if (!activeGameId || !gameById(activeGameId)) {
    renderChartEmpty();
    return;
  }
  filters = { ...filters, gameId: activeGameId };
  const shots = filtered();
  const unplaced = season.shots.filter(
    (s) =>
      s.gameId === activeGameId &&
      (filters.period === 'all' || s.period === filters.period) &&
      (filters.strength === 'all' || (s.strength ?? 'EV') === filters.strength) &&
      (typeof s.x !== 'number' || typeof s.y !== 'number'),
  );
  const activeGame = gameById(activeGameId)!;
  const selected = selectedShotId
    ? season.shots.find((s) => s.id === selectedShotId)
    : undefined;
  const reviewList = shots.filter((s) => typeof s.x === 'number' && typeof s.y === 'number');
  const placedCount = shots.filter((s) => s.x != null).length;
  const showGameDetails = !gameHasIdentifyingMeta(activeGame) && !settingsOpen;
  const extraToolbar =
    uiMode === 'place'
      ? placingShotId
        ? `<button type="button" class="primary" data-action="cancel-place">Placing — click rink (cancel)</button>`
        : `<button type="button" class="ghost" data-action="new-at-click">New shot on next click</button>`
      : '';

  const detailsHub = (() => {
    if (uiMode === 'place') {
      return `
        <section class="panel detail-card">
          <h2>Selected / clip</h2>
          ${
            selected
              ? `
            <div class="title">${esc(outcomeLabel(selected.outcome))} — ${esc(selected.side === 'for' ? playerName(selected.playerId) : playerName(selected.goalieId))}</div>
            <div class="meta" style="color:var(--muted);margin-bottom:0.5rem">
              ${selected.side} · P${periodLabel(selected.period)} ${selected.clock ?? ''} · ${strengthLabel(selected.strength)} ·
              ${selected.x != null ? `xy (${selected.x.toFixed(2)}, ${selected.y!.toFixed(2)})` : 'unplaced'}
            </div>
            <label class="field">Video timestamp (H:MM:SS or seconds)
              <input type="text" id="shot-ts" value="${esc(formatTimestamp(selected.videoTimestampSec))}" />
            </label>
            <div class="row" style="margin-top:0.5rem">
              <button type="button" class="primary" data-action="open-clip" data-shot="${selected.id}">Open clip</button>
              <button type="button" data-action="save-shot-ts" data-shot="${selected.id}">Save timestamp</button>
              <button type="button" class="danger" data-action="delete-shot" data-shot="${selected.id}">Delete</button>
            </div>
          `
              : `<p class="hint">Select an unplaced row or place a new shot.</p>`
          }
        </section>
        <section class="panel">
          <h2>Unplaced (${unplaced.length})</h2>
          <div class="unplaced" id="unplaced-list">
            ${
              unplaced.length === 0
                ? '<p class="hint">None — import a CSV or add a new shot.</p>'
                : unplaced
                    .map((s) => {
                      const who =
                        s.side === 'for' ? playerName(s.playerId) : `vs ${playerName(s.goalieId)}`;
                      const active = placingShotId === s.id ? 'active' : '';
                      return `<div class="unplaced-item ${active}" data-place="${s.id}">
                        <div>
                          <div>${esc(outcomeLabel(s.outcome))} · ${esc(who)}</div>
                          <div class="meta">P${periodLabel(s.period)} ${s.clock ?? ''} · ${strengthLabel(s.strength)} · ${s.side}${s.videoTimestampSec != null ? ` · t=${formatTimestamp(s.videoTimestampSec)}` : ''}</div>
                        </div>
                        <button type="button" data-place="${s.id}">Place</button>
                      </div>`;
                    })
                    .join('')
            }
          </div>
        </section>`;
    }
    // review
    if (!selected) {
      return `
        <section class="panel detail-card">
          <h2>Selected / clip</h2>
          <p class="hint">Select a shot from the list or click a marker on the rink.</p>
        </section>`;
    }
    return `
      <section class="panel detail-card">
        <h2>Selected / clip</h2>
        <div class="title">${esc(outcomeLabel(selected.outcome))} — ${esc(selected.side === 'for' ? playerName(selected.playerId) : playerName(selected.goalieId))}</div>
        <div class="meta" style="color:var(--muted);margin-bottom:0.5rem">
          ${selected.side} · P${periodLabel(selected.period)} ${selected.clock ?? ''} · ${strengthLabel(selected.strength)} ·
          ${selected.x != null ? `xy (${selected.x.toFixed(2)}, ${selected.y!.toFixed(2)})` : 'unplaced'}
        </div>
        <label class="field">Video timestamp (H:MM:SS or seconds)
          <input type="text" id="shot-ts" value="${esc(formatTimestamp(selected.videoTimestampSec))}" />
        </label>
        <div class="row" style="margin-top:0.5rem">
          <button type="button" class="primary" data-action="open-clip" data-shot="${selected.id}">Open clip</button>
          <button type="button" data-action="save-shot-ts" data-shot="${selected.id}">Save timestamp</button>
          <button type="button" class="${reviewEditing ? 'primary' : ''}" data-action="toggle-review-edit">${reviewEditing ? 'Done editing' : 'Edit'}</button>
          <button type="button" class="danger" data-action="delete-shot" data-shot="${selected.id}">Delete</button>
        </div>
        ${
          reviewEditing
            ? `
        <div class="stack" style="margin-top:0.75rem;padding-top:0.65rem;border-top:1px solid var(--line)">
          <label class="field">Side
            <select id="edit-side">
              <option value="for" ${selected.side === 'for' ? 'selected' : ''}>For</option>
              <option value="against" ${selected.side === 'against' ? 'selected' : ''}>Against</option>
            </select>
          </label>
          <label class="field">Period
            <select id="edit-period">
              ${periodOptions(selected.period ?? plotPeriod, false)}
            </select>
          </label>
          <label class="field">Strength
            <select id="edit-strength">
              ${strengthOptions(selected.strength ?? 'EV', false)}
            </select>
          </label>
          <label class="field">Outcome
            <select id="edit-outcome">
              ${
                selected.side === 'for'
                  ? `<option value="goal" ${selected.outcome === 'goal' ? 'selected' : ''}>Goal</option>
                     <option value="miss" ${selected.outcome === 'miss' ? 'selected' : ''}>Miss / on-goal</option>`
                  : `<option value="save" ${selected.outcome === 'save' ? 'selected' : ''}>Save</option>
                     <option value="goal_against" ${selected.outcome === 'goal_against' ? 'selected' : ''}>Goal against</option>`
              }
            </select>
          </label>
          ${
            selected.side === 'for'
              ? `<label class="field">Player
                  <select id="edit-player">
                    ${skaters().map((p) => `<option value="${p.id}" ${selected.playerId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                  </select>
                </label>`
              : `<label class="field">Goalie
                  <select id="edit-goalie">
                    ${goalies().map((p) => `<option value="${p.id}" ${selected.goalieId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                  </select>
                </label>`
          }
          <div class="row">
            <button type="button" class="primary" data-action="save-edit">Save fields</button>
            <button type="button" data-action="re-place" class="${relocatingShotId === selected.id ? 'primary' : ''}">${relocatingShotId === selected.id ? 'Click rink…' : 'Re-place'}</button>
            <button type="button" class="danger" data-action="delete-shot" data-shot="${selected.id}">Delete</button>
          </div>
        </div>
        `
            : ''
        }
      </section>`;
  })();

  app.innerHTML = `
    ${headerHtml()}
    <div class="chart-page">
      <div class="mode-bar">
        <div class="mode-toggle">
          <button type="button" data-action="ui-mode" data-mode="place" class="${uiMode === 'place' ? 'active' : ''}">Place</button>
          <button type="button" data-action="ui-mode" data-mode="review" class="${uiMode === 'review' ? 'active' : ''}">Review</button>
        </div>
      </div>

      <div class="player-band">
        <div class="live-side our" aria-label="Our marks">
          <button type="button" class="live-big our-shot" data-action="live-mark" data-kind="our_shot">Our shot</button>
          <button type="button" class="live-big our-goal" data-action="live-mark" data-kind="our_goal">Our goal</button>
        </div>
        <div class="film-center">
          <div class="film-aspect">
            <div id="yt-slot"></div>
            <div class="film-fallback" id="film-fallback" ${extractYoutubeId(activeGame.videoUrl) && !ytErrorMsg ? 'hidden' : ''}>
              <p class="film-fallback-msg">${esc(ytErrorMsg || (activeGame.videoUrl ? 'Loading player…' : 'No YouTube URL — open Settings to add film.'))}</p>
              <button type="button" class="primary" data-action="open-film-fallback">Open clip at t=${formatTimestamp(ytSavedTime || 0)}</button>
            </div>
          </div>
        </div>
        <div class="live-side opp" aria-label="Opponent marks">
          <button type="button" class="live-big opp-shot" data-action="live-mark" data-kind="opp_shot">Opp shot</button>
          <button type="button" class="live-big opp-goal" data-action="live-mark" data-kind="opp_goal">Opp goal</button>
        </div>
      </div>

      <div class="strength-band">
        <div class="live-strength mode-toggle three" role="group" aria-label="Strength">
          <button type="button" data-action="live-strength" data-strength="EV" class="${plotStrength === 'EV' ? 'active' : ''}">EV</button>
          <button type="button" data-action="live-strength" data-strength="PP" class="${plotStrength === 'PP' ? 'active' : ''}">PP</button>
          <button type="button" data-action="live-strength" data-strength="SH" class="${plotStrength === 'SH' ? 'active' : ''}">SH</button>
        </div>
        <label class="live-rewind"><input type="checkbox" id="live-rewind" ${liveRewind4s ? 'checked' : ''} /> Rewind 4s</label>
        <button type="button" class="ghost" data-action="live-mark-now" title="Stamp current time without rewind">Mark at current time</button>
        <button type="button" class="ghost" data-action="open-film-fallback">Open clip</button>
        ${
          uiMode === 'place'
            ? `<label class="field sticky-period strength-period">Period
                <select id="plot-period">${periodOptions(plotPeriod, false)}</select>
              </label>`
            : ''
        }
      </div>

      ${
        livePending
          ? `<div class="live-pending-banner">
              <strong>Place ${esc(liveActionMeta(livePending.kind).label)}</strong>
              <span class="meta">t=${formatTimestamp(livePending.videoTimestampSec)} · P${periodLabel(livePending.period)} · ${livePending.strength}</span>
              <div class="live-place-fields">
                ${
                  livePending.side === 'for'
                    ? `<label class="field">Player
                        <select id="live-place-player">
                          ${skaters().map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">Add player</option>'}
                        </select>
                      </label>
                      <label class="field">New player
                        <input type="text" id="live-new-player" placeholder="#99 Name" />
                      </label>`
                    : `<label class="field">Our goalie
                        <select id="live-place-goalie">
                          ${goalies().map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">Add goalie</option>'}
                        </select>
                      </label>
                      <label class="field">New goalie
                        <input type="text" id="live-new-goalie" placeholder="#1 Name" />
                      </label>`
                }
              </div>
              <span>Tap rink to place</span>
              <button type="button" class="ghost" data-action="cancel-live-pending">Cancel</button>
            </div>`
          : ''
      }

      <div class="chart-below">
        <div class="chart-details">
          ${
            showGameDetails
              ? `
          <section class="panel">
            <h2>Game details</h2>
            <div class="stack">
              <label class="field">Opponent
                <input type="text" id="game-opponent" placeholder="e.g. Rangers" value="${esc(activeGame.opponent ?? '')}" />
              </label>
              <label class="field">Date
                <input type="date" id="game-date" value="${esc(activeGame.date ?? '')}" />
              </label>
              <label class="field">Location
                <input type="text" id="game-location" placeholder="Rink / city" value="${esc(activeGame.location ?? '')}" />
              </label>
              <label class="field">Game film URL (YouTube)
                <input type="url" id="game-video" placeholder="https://www.youtube.com/watch?v=…" value="${esc(activeGame.videoUrl ?? '')}" />
              </label>
              <button type="button" data-action="save-game">Save</button>
            </div>
          </section>`
              : ''
          }

          ${
            uiMode === 'place'
              ? `
          <section class="panel">
            <h2>Plot</h2>
            <div class="mode-toggle">
              <button type="button" data-action="mode" data-mode="our_shot" class="${plotMode === 'our_shot' ? 'active' : ''}">Our shot</button>
              <button type="button" data-action="mode" data-mode="shot_against" class="${plotMode === 'shot_against' ? 'active' : ''}">Shot against</button>
            </div>
            <div class="stack" style="margin-top:0.65rem">
              <label class="field sticky-period">Strength
                <select id="plot-strength">
                  ${strengthOptions(plotStrength, false)}
                </select>
              </label>
              ${
                plotMode === 'our_shot'
                  ? `
                <label class="field">Player
                  <select id="plot-player">
                    ${skaters().map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">Add via CSV / new</option>'}
                  </select>
                </label>
                <label class="field">Outcome
                  <select id="plot-outcome">
                    <option value="goal">Goal</option>
                    <option value="miss" selected>Miss / on-goal</option>
                  </select>
                </label>
                <label class="field">New player (optional)
                  <input type="text" id="new-player" placeholder="#99 Name" />
                </label>
              `
                  : `
                <label class="field">Our goalie
                  <select id="plot-goalie">
                    ${goalies().map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">Add via CSV / new</option>'}
                  </select>
                </label>
                <label class="field">Outcome
                  <select id="plot-outcome">
                    <option value="save" selected>Save</option>
                    <option value="goal_against">Goal against</option>
                  </select>
                </label>
                <label class="field">New goalie (optional)
                  <input type="text" id="new-goalie" placeholder="#1 Name" />
                </label>
              `
              }
            </div>
          </section>
          `
              : ''
          }

          <section class="panel">
            <h2>Filters</h2>
            <div class="stack">
              <label class="field">Period
                <select id="filter-period">
                  ${periodOptions(filters.period, true)}
                </select>
              </label>
              <label class="field">Strength
                <select id="filter-strength">
                  ${strengthOptions(filters.strength, true)}
                </select>
              </label>
              <label class="field">Side
                <select id="filter-side">
                  <option value="both" ${filters.side === 'both' ? 'selected' : ''}>Both</option>
                  <option value="for" ${filters.side === 'for' ? 'selected' : ''}>For</option>
                  <option value="against" ${filters.side === 'against' ? 'selected' : ''}>Against</option>
                </select>
              </label>
              <label class="field">Player (for)
                <select id="filter-player">
                  <option value="all">All players</option>
                  ${skaters().map((p) => `<option value="${p.id}" ${filters.playerId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                </select>
              </label>
              <label class="field">Goalie (against)
                <select id="filter-goalie">
                  <option value="all">All goalies</option>
                  ${goalies().map((p) => `<option value="${p.id}" ${filters.goalieId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                </select>
              </label>
            </div>
          </section>

          ${
            uiMode === 'review'
              ? `
          <section class="panel">
            <h2>Shot list (${reviewList.length})</h2>
            <div class="shot-list" id="review-list">
              ${
                reviewList.length === 0
                  ? '<p class="hint">No placed shots for current filters.</p>'
                  : reviewList
                      .map((s) => {
                        const who =
                          s.side === 'for' ? playerName(s.playerId) : `vs ${playerName(s.goalieId)}`;
                        const active = selectedShotId === s.id ? 'active' : '';
                        const clip =
                          s.clipUrl || s.videoTimestampSec != null
                            ? `<button type="button" class="ghost small" data-action="open-clip" data-shot="${s.id}">Clip</button>`
                            : '';
                        return `<div class="shot-row ${active}" data-review="${s.id}">
                          <div class="shot-row-main">
                            <div>${esc(outcomeLabel(s.outcome))} · ${esc(who)}</div>
                            <div class="meta">P${periodLabel(s.period)} ${s.clock ?? ''} · ${strengthLabel(s.strength)} · ${s.side}${s.videoTimestampSec != null ? ` · t=${formatTimestamp(s.videoTimestampSec)}` : ''}</div>
                          </div>
                          ${clip}
                        </div>`;
                      })
                      .join('')
              }
            </div>
          </section>
          `
              : ''
          }

          ${detailsHub}

          <section class="panel">
            <h2>Game stats</h2>
            ${statsInnerHtml(shots)}
          </section>

          <section class="panel">
            <h2>Import / persist</h2>
            <div class="stack">
              <p class="hint">CSV seeds unplaced events for <strong>this game</strong>.</p>
              <label class="field">CSV import
                <input type="file" id="csv-file" accept=".csv,text/csv" />
              </label>
              <button type="button" class="ghost" data-action="load-sample">Load sample-game.csv</button>
              ${persistButtonsHtml()}
            </div>
          </section>
        </div>

        <div class="chart-rink">
          ${rinkBlockHtml(`${placedCount} placed · ${unplaced.length} unplaced · ${formatGameLabel(activeGame)}`, extraToolbar)}
        </div>
      </div>

      <footer class="chart-footer">
        <button type="button" class="ghost" data-action="open-settings">Settings</button>
      </footer>
    </div>
    ${settingsModalHtml(activeGame)}
  `;
}

function paintRink(shots: ShotEvent[]) {
  const wrap = document.getElementById('rink-wrap') as HTMLDivElement | null;
  const stage = document.getElementById('rink-stage') as HTMLDivElement | null;
  const img = document.getElementById('rink-img') as HTMLImageElement | null;
  const canvas = document.getElementById('heat-canvas') as HTMLCanvasElement | null;
  const markers = document.getElementById('markers');
  if (!wrap || !stage || !img || !canvas || !markers) return;

  const syncSize = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (w < 10 || h < 10) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (showHeatmap) drawHeatmap(canvas, shots);
    else {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }

    markers.innerHTML = '';
    const hasSel = Boolean(selectedShotId) && screen === 'chart';
    markers.classList.toggle('has-selection', hasSel);
    wrap.classList.toggle('has-selection', hasSel);
    if (!showMarkers) return;

    const peNone = screen !== 'chart' || uiMode === 'place';
    for (const s of shots) {
      if (typeof s.x !== 'number' || typeof s.y !== 'number') continue;
      const el = document.createElement('button');
      el.type = 'button';
      const isSel = screen === 'chart' && selectedShotId === s.id;
      el.className = `marker ${s.outcome}${isSel ? ' selected' : ''}${isSel ? ' pulse' : ''}`;
      el.style.left = `${s.x * 100}%`;
      el.style.top = `${s.y * 100}%`;
      if (peNone) el.style.pointerEvents = 'none';
      el.title = `${outcomeLabel(s.outcome)} · ${s.side === 'for' ? playerName(s.playerId) : playerName(s.goalieId)} · P${periodLabel(s.period)}`;
      el.dataset.shotId = s.id;
      if (!peNone) {
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          onMarkerClick(ev, s, shots);
        });
      }
      markers.appendChild(el);
    }
  };

  if (img.complete) syncSize();
  else img.onload = () => syncSize();
  requestAnimationFrame(syncSize);
}

function onMarkerClick(ev: MouseEvent, shot: ShotEvent, shots: ShotEvent[]) {
  if (screen !== 'chart' || uiMode === 'place') return;

  const wrap = document.getElementById('rink-wrap');
  if (!wrap) return;

  // Overlap picker within ~12px screen distance
  const near = findOverlapping(ev.clientX, ev.clientY, shots, wrap, 12);
  if (near.length > 1) {
    stackPicker = near;
    selectedShotId = null;
    render();
    return;
  }

  stackPicker = null;
  selectedShotId = shot.id;
  relocatingShotId = null;
  render();
}

function findOverlapping(
  clientX: number,
  clientY: number,
  shots: ShotEvent[],
  wrap: HTMLElement,
  thresholdPx: number,
): ShotEvent[] {
  const hits: { s: ShotEvent; d: number }[] = [];

  for (const s of shots) {
    if (typeof s.x !== 'number' || typeof s.y !== 'number') continue;
    const markerEl = wrap.querySelector(`[data-shot-id="${CSS.escape(s.id)}"]`) as HTMLElement | null;
    let px: number;
    let py: number;
    if (markerEl) {
      const mr = markerEl.getBoundingClientRect();
      px = mr.left + mr.width / 2;
      py = mr.top + mr.height / 2;
    } else {
      const rect = wrap.getBoundingClientRect();
      const { nx, ny } = rinkToView(s.x, s.y);
      px = rect.left + nx * rect.width;
      py = rect.top + ny * rect.height;
    }
    const d = Math.hypot(px - clientX, py - clientY);
    if (d <= thresholdPx) hits.push({ s, d });
  }
  hits.sort((a, b) => a.d - b.d);
  return hits.map((h) => h.s);
}

function normCoords(ev: MouseEvent | TouchEvent, wrap: HTMLElement): { x: number; y: number } {
  const rect = wrap.getBoundingClientRect();
  const point =
    'touches' in ev ? ev.touches[0] || ev.changedTouches[0] : (ev as MouseEvent);
  const nx = (point.clientX - rect.left) / rect.width;
  const ny = (point.clientY - rect.top) / rect.height;
  return viewToRink(
    Math.min(1, Math.max(0, nx)),
    Math.min(1, Math.max(0, ny)),
  );
}

function placeAt(x: number, y: number) {
  if (relocatingShotId) {
    season = updateShot(season, relocatingShotId, { x, y });
    selectedShotId = relocatingShotId;
    relocatingShotId = null;
    // Stay in Review with selection; keep reviewEditing true
    persist();
    toast('Shot moved');
    render();
    return;
  }

  if (screen !== 'chart' || uiMode !== 'place') return;

  if (placingShotId) {
    season = updateShot(season, placingShotId, { x, y });
    selectedShotId = placingShotId;
    placingShotId = null;
    persist();
    toast('Shot placed on rink');
    render();
    return;
  }

  const gameId = activeGameId;
  if (!gameId) {
    toast('Select a game from Home first', 'error');
    return;
  }
  let side: Side;
  let outcome: Outcome;
  let playerId: string | undefined;
  let goalieId: string | undefined;

  // Live mark pending: stamped from YouTube + sticky period/strength
  if (livePending) {
    side = livePending.side;
    outcome = livePending.outcome;
    const periodForShot = livePending.period;
    const strengthForShot = livePending.strength;
    const videoTimestampSec = livePending.videoTimestampSec;
    plotPeriod = periodForShot;
    plotStrength = strengthForShot;
    if (side === 'for') {
      const sel =
        (document.getElementById('live-place-player') as HTMLSelectElement | null) ||
        (document.getElementById('plot-player') as HTMLSelectElement | null);
      const newP = (document.getElementById('live-new-player') as HTMLInputElement | null)?.value.trim();
      if (newP) {
        const parsed = parsePlayerField(newP) ?? { id: slugId(newP), name: newP };
        season = upsertPlayer(season, {
          id: parsed.id,
          name: parsed.name,
          number: parsed.number,
          role: 'skater',
        });
        playerId = parsed.id;
      } else {
        playerId = sel?.value || undefined;
        if (!playerId) {
          toast('Pick a player for this shot', 'error');
          return;
        }
      }
    } else {
      const sel =
        (document.getElementById('live-place-goalie') as HTMLSelectElement | null) ||
        (document.getElementById('plot-goalie') as HTMLSelectElement | null);
      const newG = (document.getElementById('live-new-goalie') as HTMLInputElement | null)?.value.trim();
      if (newG) {
        const parsed = parsePlayerField(newG) ?? { id: slugId(newG), name: newG };
        season = upsertPlayer(season, {
          id: parsed.id,
          name: parsed.name,
          number: parsed.number,
          role: 'goalie',
        });
        goalieId = parsed.id;
      } else {
        goalieId = sel?.value || undefined;
        if (!goalieId) {
          toast('Pick a goalie for this shot', 'error');
          return;
        }
      }
    }

    const shot: ShotEvent = {
      id: uid('shot'),
      gameId,
      side,
      outcome,
      x,
      y,
      playerId,
      goalieId,
      period: periodForShot,
      strength: strengthForShot,
      videoTimestampSec,
      createdAt: new Date().toISOString(),
      kind: 'shot',
    };
    season = addShot(season, shot);
    selectedShotId = shot.id;
    livePending = null;
    persist();
    toast(
      `Live mark saved · ${outcomeLabel(outcome)} @ ${formatTimestamp(videoTimestampSec)} · P${periodLabel(periodForShot)} · ${strengthForShot}`,
    );
    try {
      ytPlayer?.play();
    } catch {
      /* ignore */
    }
    ytWantPaused = false;
    render();
    return;
  }

  const periodEl = document.getElementById('plot-period') as HTMLSelectElement | null;
  if (periodEl) {
    const v = periodEl.value;
    plotPeriod = v === 'OT' ? 'OT' : (Number(v) as 1 | 2 | 3);
  }
  const strengthEl = document.getElementById('plot-strength') as HTMLSelectElement | null;
  if (strengthEl) {
    const v = strengthEl.value;
    if (v === 'EV' || v === 'PP' || v === 'SH') plotStrength = v;
  }

  if (plotMode === 'our_shot') {
    side = 'for';
    const outcomeEl = document.getElementById('plot-outcome') as HTMLSelectElement | null;
    outcome = (outcomeEl?.value as Outcome) || 'miss';
    const newP = (document.getElementById('new-player') as HTMLInputElement | null)?.value.trim();
    if (newP) {
      const parsed = parsePlayerField(newP) ?? { id: slugId(newP), name: newP };
      season = upsertPlayer(season, {
        id: parsed.id,
        name: parsed.name,
        number: parsed.number,
        role: 'skater',
      });
      playerId = parsed.id;
    } else {
      const sel = document.getElementById('plot-player') as HTMLSelectElement | null;
      playerId = sel?.value || undefined;
      if (!playerId) {
        toast('Pick or enter a player', 'error');
        return;
      }
    }
  } else {
    side = 'against';
    const outcomeEl = document.getElementById('plot-outcome') as HTMLSelectElement | null;
    outcome = (outcomeEl?.value as Outcome) || 'save';
    const newG = (document.getElementById('new-goalie') as HTMLInputElement | null)?.value.trim();
    if (newG) {
      const parsed = parsePlayerField(newG) ?? { id: slugId(newG), name: newG };
      season = upsertPlayer(season, {
        id: parsed.id,
        name: parsed.name,
        number: parsed.number,
        role: 'goalie',
      });
      goalieId = parsed.id;
    } else {
      const sel = document.getElementById('plot-goalie') as HTMLSelectElement | null;
      goalieId = sel?.value || undefined;
      if (!goalieId) {
        toast('Pick or enter a goalie', 'error');
        return;
      }
    }
  }

  const shot: ShotEvent = {
    id: uid('shot'),
    gameId,
    side,
    outcome,
    x,
    y,
    playerId,
    goalieId,
    period: plotPeriod,
    strength: plotStrength,
    createdAt: new Date().toISOString(),
    kind: 'shot',
  };
  season = addShot(season, shot);
  selectedShotId = shot.id;
  persist();
  toast(`Shot plotted (P${periodLabel(plotPeriod)} · ${plotStrength})`);
  render();
}

async function loadSampleCsv() {
  try {
    const res = await fetch(`${ASSET_BASE}sample-game.csv`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    applyCsv(text, 'Sample game');
  } catch (e) {
    toast(`Failed to load sample: ${e}`, 'error');
  }
}

function applyCsv(text: string, label?: string) {
  try {
    const result = importGameCsv(season, text, {
      gameId: activeGameId ?? undefined,
      gameLabel: label,
    });
    season = result.season;
    setActiveGame(result.gameId);
    persist();
    toast(`Imported ${result.imported} events (${result.skipped} skipped). Place them on the rink.`);
    screen = 'chart';
    setUiMode('place');
  } catch (e) {
    toast(`CSV import failed: ${e}`, 'error');
  }
}

function openClipFor(shot: ShotEvent) {
  const game = gameById(shot.gameId);
  const url = buildClipUrl(game?.videoUrl, shot.clipUrl, shot.videoTimestampSec);
  if (!url) {
    toast('Set a game film YouTube URL first (Settings)', 'error');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function parsePeriodSelect(el: HTMLSelectElement | null): Period {
  const v = el?.value ?? '1';
  if (v === 'OT') return 'OT';
  const n = Number(v);
  return n === 2 || n === 3 ? n : 1;
}

function parseStrengthSelect(el: HTMLSelectElement | null): Strength {
  const v = el?.value ?? 'EV';
  return v === 'PP' || v === 'SH' ? v : 'EV';
}

function bind() {
  document.querySelectorAll('[data-screen]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = (btn as HTMLElement).dataset.screen as AppScreen;
      if (next === 'home' || next === 'chart' || next === 'reports') goto(next);
    });
  });

  document.querySelectorAll('[data-open-game]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.openGame;
      if (!id) return;
      const prevGame = activeGameId;
      setActiveGame(id);
      uiMode = 'place';
      showMarkers = false;
      placingShotId = null;
      selectedShotId = null;
      relocatingShotId = null;
      reviewEditing = false;
      stackPicker = null;
      livePending = null;
      if (prevGame !== id) {
        ytSavedTime = 0;
        ytWantPaused = false;
        // Remount if video id differs (destroy forces recreate in mount)
        const prevUrl = prevGame ? gameById(prevGame)?.videoUrl : undefined;
        const nextUrl = gameById(id)?.videoUrl;
        if (extractYoutubeId(prevUrl) !== extractYoutubeId(nextUrl)) {
          destroyYtPlayer();
        }
      }
      goto('chart');
    });
  });

  document.querySelector('[data-action="create-game"]')?.addEventListener('click', () => {
    const opponent =
      (document.getElementById('create-opponent') as HTMLInputElement | null)?.value.trim() ||
      undefined;
    const date =
      (document.getElementById('create-date') as HTMLInputElement | null)?.value.trim() ||
      todayIso();
    const location =
      (document.getElementById('create-location') as HTMLInputElement | null)?.value.trim() ||
      undefined;
    const videoUrl =
      (document.getElementById('create-video') as HTMLInputElement | null)?.value.trim() ||
      undefined;
    const id = uid('game');
    const label = composeGameLabel({
      opponent,
      date,
      location,
      label: opponent ? undefined : `Game ${season.games.length + 1}`,
    });
    season = upsertGame(season, {
      id,
      label,
      opponent,
      date,
      location,
      videoUrl,
      createdAt: new Date().toISOString(),
    });
    persist();
    setActiveGame(id);
    uiMode = 'place';
    showMarkers = false;
    placingShotId = null;
    selectedShotId = null;
    toast(`Created ${label}`);
    goto('chart');
  });

  document.querySelector('[data-action="reports-open-chart"]')?.addEventListener('click', () => {
    if (filters.gameId !== 'all') {
      setActiveGame(filters.gameId);
      goto('chart');
    }
  });

  document.querySelectorAll('[data-action="ui-mode"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setUiMode((btn as HTMLElement).dataset.mode as UiMode);
    });
  });

  document.querySelectorAll('[data-action="mode"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      plotMode = (btn as HTMLElement).dataset.mode as PlotMode;
      placingShotId = null;
      render();
    });
  });

  document.querySelectorAll('[data-action="extent"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      rinkExtent = (btn as HTMLElement).dataset.extent as RinkExtent;
      render();
    });
  });

  document.querySelector('[data-action="flip-attack"]')?.addEventListener('click', () => {
    attackFlip = !attackFlip;
    render();
  });

  const plotPeriodEl = document.getElementById('plot-period') as HTMLSelectElement | null;
  plotPeriodEl?.addEventListener('change', () => {
    plotPeriod = parsePeriodSelect(plotPeriodEl);
  });
  const plotStrengthEl = document.getElementById('plot-strength') as HTMLSelectElement | null;
  plotStrengthEl?.addEventListener('change', () => {
    plotStrength = parseStrengthSelect(plotStrengthEl);
    // Keep Live EV|PP|SH strip in sync
    render();
  });

  const fg = document.getElementById('filter-game') as HTMLSelectElement | null;
  fg?.addEventListener('change', () => {
    filters = { ...filters, gameId: fg.value as Filters['gameId'] };
    render();
  });
  const fper = document.getElementById('filter-period') as HTMLSelectElement | null;
  fper?.addEventListener('change', () => {
    const v = fper.value;
    filters = {
      ...filters,
      period: v === 'all' ? 'all' : v === 'OT' ? 'OT' : (Number(v) as 1 | 2 | 3),
    };
    render();
  });
  const fstr = document.getElementById('filter-strength') as HTMLSelectElement | null;
  fstr?.addEventListener('change', () => {
    const v = fstr.value;
    filters = {
      ...filters,
      strength: v === 'all' || v === 'EV' || v === 'PP' || v === 'SH' ? v : 'all',
    };
    render();
  });
  const fs = document.getElementById('filter-side') as HTMLSelectElement | null;
  fs?.addEventListener('change', () => {
    filters = { ...filters, side: fs.value as Filters['side'] };
    render();
  });
  const fp = document.getElementById('filter-player') as HTMLSelectElement | null;
  fp?.addEventListener('change', () => {
    filters = {
      ...filters,
      playerId: fp.value as Filters['playerId'],
      goalieId: fp.value !== 'all' ? 'all' : filters.goalieId,
    };
    render();
  });
  const fgo = document.getElementById('filter-goalie') as HTMLSelectElement | null;
  fgo?.addEventListener('change', () => {
    filters = {
      ...filters,
      goalieId: fgo.value as Filters['goalieId'],
      playerId: fgo.value !== 'all' ? 'all' : filters.playerId,
    };
    render();
  });
  const fout = document.getElementById('filter-outcome') as HTMLSelectElement | null;
  fout?.addEventListener('change', () => {
    const v = fout.value;
    const outcome: Filters['outcome'] =
      v === 'goal' || v === 'miss' || v === 'save' || v === 'goal_against' ? v : 'all';
    filters = { ...filters, outcome };
    render();
  });

  document.getElementById('tog-heat')?.addEventListener('change', (e) => {
    showHeatmap = (e.target as HTMLInputElement).checked;
    render();
  });
  document.getElementById('tog-markers')?.addEventListener('change', (e) => {
    showMarkers = (e.target as HTMLInputElement).checked;
    render();
  });

  document.querySelector('[data-action="load-sample"]')?.addEventListener('click', () => loadSampleCsv());
  document.querySelector('[data-action="cancel-place"]')?.addEventListener('click', () => {
    placingShotId = null;
    render();
  });
  document.querySelector('[data-action="new-at-click"]')?.addEventListener('click', () => {
    placingShotId = null;
    toast('Click the rink to plot a new shot with current plot settings');
  });

  document.querySelector('[data-action="save-edit"]')?.addEventListener('click', () => {
    if (!selectedShotId) return;
    const side = (document.getElementById('edit-side') as HTMLSelectElement).value as Side;
    const period = parsePeriodSelect(document.getElementById('edit-period') as HTMLSelectElement);
    const strength = parseStrengthSelect(document.getElementById('edit-strength') as HTMLSelectElement);
    let outcome = (document.getElementById('edit-outcome') as HTMLSelectElement).value as Outcome;
    const patch: Partial<ShotEvent> = { side, period, strength, outcome };
    if (side === 'for') {
      patch.playerId = (document.getElementById('edit-player') as HTMLSelectElement | null)?.value;
      patch.goalieId = undefined;
      if (outcome !== 'goal' && outcome !== 'miss') outcome = 'miss';
      patch.outcome = outcome;
    } else {
      patch.goalieId = (document.getElementById('edit-goalie') as HTMLSelectElement | null)?.value;
      patch.playerId = undefined;
      if (outcome !== 'save' && outcome !== 'goal_against') outcome = 'save';
      patch.outcome = outcome;
    }
    season = updateShot(season, selectedShotId, patch);
    persist();
    toast('Shot updated');
    render();
  });

  document.querySelector('[data-action="re-place"]')?.addEventListener('click', () => {
    if (!selectedShotId) return;
    relocatingShotId = selectedShotId;
    toast('Click the rink to move this shot');
    render();
  });

  document.querySelector('[data-action="close-picker"]')?.addEventListener('click', () => {
    stackPicker = null;
    render();
  });

  document.querySelectorAll('[data-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedShotId = (btn as HTMLElement).dataset.pick || null;
      stackPicker = null;
      render();
    });
  });

  document.querySelectorAll('[data-review]').forEach((row) => {
    row.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('[data-action="open-clip"]')) return;
      selectedShotId = (row as HTMLElement).dataset.review || null;
      showMarkers = true;
      render();
    });
  });

  document.querySelector('[data-action="save-game"]')?.addEventListener('click', () => {
    const gid = activeGameId;
    if (!gid) return;
    const g = gameById(gid);
    if (!g) return;
    const meta = readGameMetaFromForm();
    const updated = {
      ...g,
      opponent: meta.opponent,
      date: meta.date,
      location: meta.location,
      videoUrl: meta.videoUrl,
      label: composeGameLabel({
        opponent: meta.opponent,
        date: meta.date,
        location: meta.location,
        label: g.label,
      }),
    };
    const prevId = extractYoutubeId(g.videoUrl);
    const nextId = extractYoutubeId(updated.videoUrl);
    season = upsertGame(season, updated);
    persist();
    if (prevId !== nextId) {
      ytSavedTime = 0;
      destroyYtPlayer();
    }
    settingsOpen = false;
    toast('Game saved');
    render();
  });

  document.querySelector('[data-action="open-settings"]')?.addEventListener('click', () => {
    settingsOpen = true;
    render();
  });

  document.querySelectorAll('[data-action="close-settings"]').forEach((el) => {
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      settingsOpen = false;
      render();
    });
  });

  document.querySelector('[data-settings-panel]')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
  });

  document.querySelector('[data-action="export-json"]')?.addEventListener('click', () => {
    const blob = new Blob([exportSeasonJson(season)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `shotsheet-season-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('csv-file')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    applyCsv(await file.text(), file.name.replace(/\.csv$/i, ''));
  });

  document.getElementById('json-file')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      season = importSeasonJson(await file.text());
      if (activeGameId && !season.games.some((g) => g.id === activeGameId)) {
        setActiveGame(season.games[0]?.id ?? null);
      }
      filters = { ...defaultFilters(), gameId: activeGameId ?? 'all' };
      persist();
      toast('Season JSON imported');
      goto('home');
    } catch (err) {
      toast(`JSON import failed: ${err}`, 'error');
    }
  });

  document.querySelectorAll('[data-place]').forEach((el) => {
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      placingShotId = (el as HTMLElement).dataset.place || null;
      selectedShotId = placingShotId;
      const shot = season.shots.find((s) => s.id === placingShotId);
      if (shot?.period) plotPeriod = shot.period;
      if (shot?.strength === 'EV' || shot?.strength === 'PP' || shot?.strength === 'SH') {
        plotStrength = shot.strength;
      }
      toast('Now click the rink to set location');
      render();
    });
  });

  document.querySelectorAll('[data-action="open-clip"]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const id = (btn as HTMLElement).dataset.shot;
      const shot = season.shots.find((s) => s.id === id);
      if (shot) openClipFor(shot);
    });
  });

  document.querySelector('[data-action="save-shot-ts"]')?.addEventListener('click', () => {
    const btn = document.querySelector('[data-action="save-shot-ts"]') as HTMLElement;
    const id = btn.dataset.shot!;
    const raw = (document.getElementById('shot-ts') as HTMLInputElement).value;
    const sec = parseTimestampToSeconds(raw);
    season = updateShot(season, id, { videoTimestampSec: sec });
    persist();
    toast(sec != null ? `Timestamp saved (${formatTimestamp(sec)})` : 'Timestamp cleared');
    render();
  });

  document.querySelectorAll('[data-action="delete-shot"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.shot!;
      season = removeShot(season, id);
      if (selectedShotId === id) {
        selectedShotId = null;
        reviewEditing = false;
      }
      if (placingShotId === id) placingShotId = null;
      if (relocatingShotId === id) relocatingShotId = null;
      persist();
      toast('Shot deleted');
      render();
    });
  });

  // Side change in review-edit rebuilds outcome options via re-render after save; live swap:
  document.getElementById('edit-side')?.addEventListener('change', () => {
    // Soft re-render keeping selection — apply side first so form matches
    if (!selectedShotId) return;
    const side = (document.getElementById('edit-side') as HTMLSelectElement).value as Side;
    const cur = season.shots.find((s) => s.id === selectedShotId);
    if (!cur) return;
    const outcome: Outcome =
      side === 'for'
        ? cur.outcome === 'goal' || cur.outcome === 'miss'
          ? cur.outcome
          : 'miss'
        : cur.outcome === 'save' || cur.outcome === 'goal_against'
          ? cur.outcome
          : 'save';
    season = updateShot(season, selectedShotId, { side, outcome });
    persist();
    render();
  });

  document.querySelector('[data-action="toggle-review-edit"]')?.addEventListener('click', () => {
    reviewEditing = !reviewEditing;
    if (!reviewEditing) relocatingShotId = null;
    render();
  });

  // —— Live YouTube mark ——
  document.getElementById('live-rewind')?.addEventListener('change', (e) => {
    liveRewind4s = (e.target as HTMLInputElement).checked;
  });

  document.querySelectorAll('[data-action="live-strength"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const st = (btn as HTMLElement).dataset.strength;
      if (st === 'EV' || st === 'PP' || st === 'SH') {
        plotStrength = st;
        const sel = document.getElementById('plot-strength') as HTMLSelectElement | null;
        if (sel) sel.value = st;
        render();
      }
    });
  });

  document.querySelectorAll('[data-action="live-mark"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = (btn as HTMLElement).dataset.kind as LiveActionKind;
      if (kind === 'our_shot' || kind === 'our_goal' || kind === 'opp_shot' || kind === 'opp_goal') {
        beginLiveMark(kind, false);
      }
    });
  });

  document.querySelector('[data-action="live-mark-now"]')?.addEventListener('click', () => {
    beginLiveMark(lastLiveAction, true);
  });

  document.querySelector('[data-action="cancel-live-pending"]')?.addEventListener('click', () => {
    cancelLivePending();
  });

  document.querySelectorAll('[data-action="open-film-fallback"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      let tsec = ytSavedTime;
      if (ytPlayer) {
        try {
          tsec = ytPlayer.getCurrentTime();
        } catch {
          /* keep saved */
        }
      }
      openClipAtTime(Math.max(0, Math.floor(tsec || 0)));
    });
  });

  const wrap = document.getElementById('rink-wrap');
  wrap?.addEventListener('click', (ev) => {
    if (screen !== 'chart') return;
    if ((ev.target as HTMLElement).closest('.stack-picker')) return;
    if ((ev.target as HTMLElement).closest('.marker')) return;
    // Review: only accept clicks when re-placing
    if (uiMode === 'review' && !relocatingShotId) return;
    const { x, y } = normCoords(ev as MouseEvent, wrap);
    placeAt(x, y);
  });
}

if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
  document.body.classList.add('standalone-pwa');
}

render();

window.addEventListener('resize', () => {
  if (screen === 'chart' || screen === 'reports') paintRink(filtered());
});
