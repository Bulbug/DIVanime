// Data source: Jikan API (free, no key) -> https://docs.api.jikan.moe
const API = "https://api.jikan.moe/v4";
const app = document.getElementById("app");
let currentGenre = null; // MAL genre ID as a string, or null for "no filter"

// OFFICIAL (legal full episodes from official YouTube channels) is defined in official.js,
// which index.html loads before this file.

// getPage returns the full response (data + pagination info). getJSON returns just the data.
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage(path, retried = false) {
  const res = await fetch(API + path);
  // 429 = "too many requests": wait a moment and try once more
  if (res.status === 429 && !retried) { await sleep(1500); return getPage(path, true); }
  if (!res.ok) {
    const err = new Error("Request failed: " + res.status);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
async function getJSON(path) {
  return (await getPage(path)).data;
}

// FRIENDLY ERRORS: say what went wrong in plain words, and always offer a way forward
function friendlyError(e) {
  if (!navigator.onLine || e instanceof TypeError) return "Can't reach the anime service. Check your internet connection.";
  if (e && e.status === 429) return "Too many requests right now. Wait a few seconds and try again.";
  if (e && e.status === 404) return "That anime could not be found.";
  return "Something went wrong while loading. Please try again.";
}

// Puts an error message with a "Try again" button (and an optional "Back" button) inside a container
function showError(container, e, retryFn, backFn) {
  container.innerHTML = `<div class="errorbox" role="alert">
    <p>${esc(friendlyError(e))}</p>
    <button class="btn retry">Try again</button>
    ${backFn ? '<button class="btn ghost backbtn">Back</button>' : ""}
  </div>`;
  container.querySelector(".retry").addEventListener("click", retryFn);
  if (backFn) container.querySelector(".backbtn").addEventListener("click", backFn);
}

// A banner at the top of the page for messages that are not tied to one spot
const banner = document.getElementById("banner");
function showBanner(msg) {
  banner.innerHTML = `<span>${esc(msg)}</span> <button class="btn small ghost" id="bannerClose">Dismiss</button>`;
  banner.hidden = false;
  document.getElementById("bannerClose").addEventListener("click", hideBanner);
}
function hideBanner() {
  banner.hidden = true;
  banner.innerHTML = "";
}
// The browser tells us when the connection drops or comes back
window.addEventListener("offline", () => showBanner("You're offline. Some things won't load until you reconnect."));
window.addEventListener("online", () => {
  hideBanner();
  const retry = document.querySelector("#app .errorbox .retry"); // retry whatever failed
  if (retry) retry.click();
});
if (!navigator.onLine) showBanner("You're offline. Some things won't load until you reconnect.");

// WATCHLIST: saved in the browser's localStorage so it stays after refresh.
// Format: { "1535": { id, title, image }, ... }
function loadList() {
  try { return JSON.parse(localStorage.getItem("divanime-list")) || {}; }
  catch (e) { return {}; }
}
function saveList(list) {
  try { localStorage.setItem("divanime-list", JSON.stringify(list)); }
  catch (e) { alert("Could not save. Your browser may be blocking storage."); }
  updateCount();
}
function updateCount() {
  document.getElementById("count").textContent = Object.keys(loadList()).length;
}

// CONTINUE WATCHING: remembers the last episode you opened for each anime.
// Format: { "1535": 12, ... }  (anime ID -> episode number)
function loadProgress() {
  try { return JSON.parse(localStorage.getItem("divanime-progress")) || {}; }
  catch (e) { return {}; }
}
function getProgress(id) {
  return loadProgress()[id] || null;
}
function saveProgress(id, ep) {
  const all = loadProgress();
  all[id] = Number(ep);
  try { localStorage.setItem("divanime-progress", JSON.stringify(all)); }
  catch (e) { /* storage blocked: progress just won't be saved */ }
}

// WATCHED EPISODES: the episodes you ticked as watched.
// Format: { "1535": [1, 2, 3], ... }  (anime ID -> list of episode numbers)
function loadWatchedAll() {
  try { return JSON.parse(localStorage.getItem("divanime-watched")) || {}; }
  catch (e) { return {}; }
}
function getWatched(id) {
  return loadWatchedAll()[id] || [];
}
function setWatched(id, eps) {
  const all = loadWatchedAll();
  if (eps.length) all[id] = eps; else delete all[id];
  try { localStorage.setItem("divanime-watched", JSON.stringify(all)); }
  catch (e) { /* storage blocked: it just won't be saved */ }
}

// RECENTLY VIEWED: the last 8 anime you opened, newest first, shown above the catalog.
// Format: [ { id, title, image }, ... ]
const RECENT_MAX = 8;
const SAFE_IMAGE = /^https:\/\/cdn\.myanimelist\.net\/[\w\/.\-]+$/; // images must come from MyAnimeList's CDN

function loadRecent() {
  try {
    const list = JSON.parse(localStorage.getItem("divanime-recent"));
    if (!Array.isArray(list)) return [];
    // only keep entries with the exact shape we expect
    return list.filter(x => x && Number.isInteger(x.id) && typeof x.title === "string" && SAFE_IMAGE.test(x.image || ""));
  } catch (e) { return []; }
}
function addRecent(a) {
  const list = loadRecent().filter(x => x.id !== a.mal_id); // move to the front if already there
  list.unshift({ id: a.mal_id, title: a.title, image: a.images.jpg.image_url });
  try { localStorage.setItem("divanime-recent", JSON.stringify(list.slice(0, RECENT_MAX))); }
  catch (e) { /* storage blocked: it just won't be saved */ }
}

function recentHTML() {
  const items = loadRecent();
  if (!items.length) return "";
  return `<section id="recent" aria-labelledby="recentTitle">
    <div class="rowhead"><h2 id="recentTitle">Recently viewed</h2><button class="btn small ghost" id="clearRecent">Clear</button></div>
    <div class="recentrow">${items.map(a => `
      <button class="card" data-id="${a.id}">
        <img src="${a.image}" alt="" loading="lazy">
        <span>${esc(a.title)}</span>
      </button>`).join("")}</div>
  </section>`;
}

// The row only shows on the normal list (not while searching or filtering by genre)
function refreshRecent() {
  const grid = document.getElementById("grid");
  const section = document.getElementById("recent");
  const wanted = !currentGenre && !document.getElementById("search").value.trim();
  const html = wanted ? recentHTML() : "";
  if (section && html) section.outerHTML = html;
  else if (section) section.remove();
  else if (html && grid) grid.insertAdjacentHTML("beforebegin", html);
}

// Small text lines shown under a card in the watchlist
function watchlistNote(id) {
  const p = getProgress(id), w = getWatched(id).length;
  return (p ? `<small class="muted">Last opened: Ep ${p}</small>` : "")
       + (w ? `<small class="muted">Watched ${w} episode${w === 1 ? "" : "s"}</small>` : "");
}

function esc(s) { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; }

// KEEP YOUR PLACE: when you open an anime, we keep the list's page elements in memory
// (not destroy them). Back puts the same elements on screen again, with the same
// loaded pages and scroll position, and no new API calls.
let currentView = "catalog"; // "catalog" | "watchlist" | "watch"
let savedView = null;        // { kind, nodes, scrollY } of the list you came from

function rememberView() {
  if (currentView === "watch") return;
  savedView = { kind: currentView, nodes: Array.from(app.childNodes), scrollY: window.scrollY };
}

function goBack() {
  const v = savedView;
  if (v && v.kind === "catalog") {
    currentView = "catalog";
    savedView = null;
    app.replaceChildren(...v.nodes);
    const moreBtn = document.getElementById("moreBtn");
    if (moreBtn) { moreBtn.disabled = false; moreBtn.textContent = "Load more"; } // in case a request was interrupted
    refreshRecent(); // the anime you just viewed should appear in the row
    window.scrollTo(0, v.scrollY);
  } else if (v && v.kind === "watchlist") {
    showWatchlist(); // rebuilt from localStorage, because you may have removed an item
    window.scrollTo(0, v.scrollY);
  } else {
    showCatalog(document.getElementById("search").value.trim());
  }
}

// TABS + PAGINATION
let currentTab = "top"; // "top" | "airing" | "upcoming" | null (null when searching or filtering by genre)
const TAB_PATHS = {
  top: "/top/anime?sfw=true",
  airing: "/top/anime?filter=airing&sfw=true",
  upcoming: "/top/anime?filter=upcoming&sfw=true",
};
let requestId = 0; // used to ignore old responses if you click quickly

// SORTING: uses Jikan's order_by and sort options on the /anime search endpoint.
// "popularity" sorts ascending because rank #1 is the most popular.
let currentSort = "default";
const SORTS = {
  score: "&order_by=score&sort=desc",
  popularity: "&order_by=popularity&sort=asc",
  newest: "&order_by=start_date&sort=desc", // can include titles that have not aired yet
  title: "&order_by=title&sort=asc",
};
// The Top tab has no status filter. Airing and Upcoming map to Jikan's status values.
const TAB_STATUS = { top: "", airing: "&status=airing", upcoming: "&status=upcoming" };

// Builds the API URL: search first, then genre, then the selected tab
function buildPath(query, page) {
  const sort = SORTS[currentSort] || "";
  let path;
  if (query) path = `/anime?q=${encodeURIComponent(query)}&sfw=true${sort}`;
  else if (currentGenre) path = `/anime?genres=${currentGenre}&sfw=true${sort || SORTS.score}`;
  else if (sort) path = `/anime?sfw=true${TAB_STATUS[currentTab || "top"]}${sort}`;
  else path = TAB_PATHS[currentTab || "top"];
  return `${path}&limit=24&page=${page}`;
}

// LOADING SKELETONS: gray placeholder shapes shown while data loads
function skeletonGrid(count = 12) {
  const card = '<div class="card skeleton"><div class="sk-img"></div><div class="sk-line"></div></div>';
  return `<div class="grid" aria-busy="true" aria-label="Loading anime">${card.repeat(count)}</div>`;
}
function watchSkeleton() {
  return `<div class="watch" aria-busy="true" aria-label="Loading anime details">
    <div class="sk-line sk-title"></div>
    <div class="sk-player"></div>
    <div class="sk-line"></div>
    <div class="sk-line short"></div>
  </div>`;
}

function cardHTML(a) {
  return `
    <button class="card" data-id="${a.mal_id}">
      <img src="${a.images.jpg.image_url}" alt="" loading="lazy">
      <span>${esc(a.title)}</span>
    </button>`;
}

// "Newest" sorts by start date, which puts titles that have not aired yet at the very top.
// We drop those (except on the Upcoming tab, where they are the point).
function dropUnaired(list) {
  if (currentSort !== "newest" || currentTab === "upcoming") return list;
  return list.filter(a => a.status !== "Not yet aired");
}

async function showCatalog(query = "", page = 1) {
  const myRequest = ++requestId;
  currentView = "catalog";
  savedView = null;
  if (page === 1) app.innerHTML = skeletonGrid();
  try {
    let res = await getPage(buildPath(query, page));
    if (myRequest !== requestId) return; // a newer request replaced this one
    let list = dropUnaired(res.data || []);

    // If filtering emptied this page, quietly try the next pages (up to 5 more)
    let lastPage = page;
    for (let extra = 0; extra < 5 && !list.length && res.pagination && res.pagination.has_next_page; extra++) {
      await sleep(400); // stay under Jikan's rate limit
      lastPage++;
      res = await getPage(buildPath(query, lastPage));
      if (myRequest !== requestId) return;
      list = dropUnaired(res.data || []);
    }
    if (page > 1 && !document.getElementById("grid")) return; // you left the list while this loaded

    if (page === 1) {
      if (!list.length) { app.innerHTML = '<p class="muted">No results. Try another title.</p>'; return; }
      app.innerHTML = (!query && !currentGenre ? recentHTML() : "") + '<div class="grid" id="grid"></div><div id="more"></div>';
      // One click listener for all cards (event delegation), so cards added later work too
      document.getElementById("grid").addEventListener("click", e => {
        const card = e.target.closest(".card");
        if (card) showWatch(card.dataset.id);
      });
    }

    document.getElementById("grid").insertAdjacentHTML("beforeend", list.map(cardHTML).join(""));

    // Show "Load more" only if the API says there is another page
    const more = document.getElementById("more");
    if (res.pagination && res.pagination.has_next_page) {
      more.innerHTML = '<button class="btn" id="moreBtn">Load more</button>';
      document.getElementById("moreBtn").addEventListener("click", () => {
        const btn = document.getElementById("moreBtn");
        btn.disabled = true;
        btn.textContent = "Loading...";
        showCatalog(query, lastPage + 1);
      });
    } else {
      more.innerHTML = '<p class="muted">You reached the end.</p>';
    }
  } catch (e) {
    if (myRequest !== requestId) return;
    if (page === 1) {
      showError(app, e, () => showCatalog(query, 1));
    } else {
      const more = document.getElementById("more");
      if (!more) return;
      showError(more, e, () => showCatalog(query, page));
    }
  }
}

function markTab() {
  document.querySelectorAll("#tabs .tab").forEach(t =>
    t.setAttribute("aria-pressed", String(t.dataset.tab === currentTab)));
}

// EPISODE LIST
let watchId = null; // which anime's watch page is open (to ignore late responses)
let watchTotal = 0;  // total episodes of that anime (0 if unknown)

function playerHTML(src, title) {
  return `<iframe class="player" id="player" src="${src}" title="${esc(title)}" allowfullscreen></iframe>`;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function episodeHTML(ep, official, lastEp, watched) {
  const ytId = official && official.type === "episodes" && official.list ? official.list[ep.mal_id] : null;
  const tags = (ep.filler ? " (filler)" : "") + (ep.recap ? " (recap)" : "");
  return `
    <li class="ep${lastEp === ep.mal_id ? " last" : ""}${watched ? " done" : ""}" data-ep="${ep.mal_id}">
      <input type="checkbox" class="epcheck" aria-label="Mark episode ${ep.mal_id} as watched"${watched ? " checked" : ""}>
      <span class="epnum">${ep.mal_id}</span>
      <span class="eptitle">${esc(ep.title || "Episode " + ep.mal_id)}${tags}
        <span class="badge">Last opened</span>
        <small class="muted">${esc(formatDate(ep.aired))}</small></span>
      <span class="epbtns">
        ${ytId ? `<button class="btn small playBtn" data-yt="${esc(ytId)}" data-ep="${ep.mal_id}">Play</button>` : ""}
        ${ep.url ? `<a class="btn small ghost" href="${ep.url}" target="_blank" rel="noopener">Details</a>` : ""}
      </span>
    </li>`;
}

// Re-draws the checkboxes from saved data
function syncRows(id) {
  const watched = getWatched(id);
  document.querySelectorAll("#epList .ep").forEach(row => {
    const done = watched.includes(Number(row.dataset.ep));
    row.classList.toggle("done", done);
    row.querySelector(".epcheck").checked = done;
  });
}

// Progress bar: "Watched X of N" plus quick buttons
function updateProgress(id) {
  const box = document.getElementById("epProgress");
  if (!box) return;
  const done = getWatched(id).length;
  const total = watchTotal || document.querySelectorAll("#epList .ep").length;
  if (!total) { box.innerHTML = ""; return; }
  box.innerHTML = `<progress max="${total}" value="${Math.min(done, total)}" aria-label="Watched episodes"></progress>
    <span class="muted">Watched ${done} of ${total}</span>
    <button class="btn small ghost" id="markAllBtn">Mark loaded as watched</button>
    <button class="btn small ghost" id="clearAllBtn">Clear</button>`;
  document.getElementById("markAllBtn").addEventListener("click", () => {
    const set = new Set(getWatched(id));
    document.querySelectorAll("#epList .ep").forEach(row => set.add(Number(row.dataset.ep)));
    setWatched(id, [...set].sort((a, b) => a - b));
    syncRows(id);
    updateProgress(id);
  });
  document.getElementById("clearAllBtn").addEventListener("click", () => {
    setWatched(id, []);
    syncRows(id);
    updateProgress(id);
  });
}

// Shows "You last opened episode N" with a jump button (only if that episode is in the loaded list)
function updateResume() {
  const box = document.getElementById("epResume");
  if (!box) return;
  const row = document.querySelector("#epList .ep.last");
  if (!row) { box.innerHTML = ""; return; }
  box.innerHTML = `<span class="muted">You last opened episode ${esc(row.dataset.ep)}.</span>
    <button class="btn small ghost" id="jumpBtn">Jump to it</button>`;
  document.getElementById("jumpBtn").addEventListener("click", () => row.scrollIntoView({ block: "center" }));
}

async function loadEpisodes(id, page) {
  const list = document.getElementById("epList");
  const more = document.getElementById("epMore");
  if (watchId !== id || !list) return; // you already left this page
  try {
    const res = await getPage(`/anime/${id}/episodes?page=${page}`);
    if (watchId !== id || !document.getElementById("epList")) return;
    const eps = res.data || [];
    if (page === 1) {
      list.innerHTML = "";
      if (!eps.length) { list.innerHTML = '<li class="muted">No episode list available yet.</li>'; return; }
      // One click listener for all Play and Details buttons (event delegation)
      list.addEventListener("click", e => {
        const btn = e.target.closest(".playBtn");
        const link = e.target.closest("a");
        const row = e.target.closest(".ep");
        if (!row || (!btn && !link)) return;

        // Remember this episode as the last one opened, and move the "Last opened" mark
        saveProgress(id, row.dataset.ep);
        list.querySelectorAll(".ep.last").forEach(r => r.classList.remove("last"));
        row.classList.add("last");
        updateResume();

        if (btn) {
          document.getElementById("playerBox").innerHTML =
            playerHTML(`https://www.youtube.com/embed/${encodeURIComponent(btn.dataset.yt)}`, "Episode " + btn.dataset.ep);
          document.getElementById("playerNote").textContent = `Playing episode ${btn.dataset.ep} (official upload).`;
          document.getElementById("playerBox").scrollIntoView({ block: "center" });
        }
      });

      // Ticking a checkbox saves it as watched (or removes it)
      list.addEventListener("change", e => {
        const box = e.target.closest(".epcheck");
        if (!box) return;
        const row = box.closest(".ep");
        const n = Number(row.dataset.ep);
        const set = new Set(getWatched(id));
        if (box.checked) set.add(n); else set.delete(n);
        setWatched(id, [...set].sort((a, b) => a - b));
        row.classList.toggle("done", box.checked);
        updateProgress(id);
      });
    }
    const official = OFFICIAL[id];
    const lastEp = getProgress(id);
    const watched = getWatched(id);
    list.insertAdjacentHTML("beforeend", eps.map(ep => episodeHTML(ep, official, lastEp, watched.includes(ep.mal_id))).join(""));
    updateResume();
    updateProgress(id);
    if (res.pagination && res.pagination.has_next_page) {
      more.innerHTML = '<button class="btn" id="epMoreBtn">Show more episodes</button>';
      document.getElementById("epMoreBtn").addEventListener("click", () => {
        const btn = document.getElementById("epMoreBtn");
        btn.disabled = true;
        btn.textContent = "Loading...";
        loadEpisodes(id, page + 1);
      });
    } else {
      more.innerHTML = "";
    }
  } catch (e) {
    if (watchId !== id || !document.getElementById("epList")) return;
    if (page === 1 && e.status === 404) {
      list.innerHTML = '<li class="muted">No episode list available yet.</li>';
    } else if (page === 1) {
      list.innerHTML = "";
      showError(more, e, () => {
        more.innerHTML = "";
        list.innerHTML = '<li class="muted">Loading episodes...</li>';
        loadEpisodes(id, 1);
      });
    } else {
      showError(more, e, () => { more.innerHTML = ""; loadEpisodes(id, page); });
    }
  }
}

// ANILIST: a second free API (no key) that gives extra links to legal streaming platforms.
// It uses GraphQL: we send one POST request that asks for exactly the fields we want.
// We find the anime by its MyAnimeList ID (idMal).
const ANILIST_URL = "https://graphql.anilist.co";
const ANILIST_QUERY = `query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME) {
    averageScore
    nextAiringEpisode { episode airingAt }
    externalLinks { site url type }
    streamingEpisodes { title thumbnail url site }
  }
}`;
const aniCache = new Map(); // so going back and forth does not ask again

async function getAniList(malId) {
  if (aniCache.has(malId)) return aniCache.get(malId);
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { idMal: Number(malId) } }),
  });
  if (res.status === 404) { aniCache.set(malId, null); return null; } // AniList does not know this title
  if (!res.ok) throw new Error("AniList failed: " + res.status);
  const json = await res.json();
  const media = json.data && json.data.Media ? json.data.Media : null;
  aniCache.set(malId, media);
  return media;
}

// Only allow https links. This blocks "javascript:" links and other tricks in data we did not write.
function safeUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === "https:" ? url.href.replace(/"/g, "%22") : "";
  } catch (e) { return ""; }
}

// Turns a number of milliseconds into words like "in 5 hours" or "in 3 days"
function timeUntil(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `in ${Math.max(minutes, 1)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  return `in ${Math.round(hours / 24)} days`;
}

async function loadAniList(id, jikanAnime) {
  try {
    const media = await getAniList(id);
    if (!media || watchId !== id) return; // nothing found, or you already left this page

    // 0. AniList score and, for shows that are still airing, when the next episode comes out
    const info = [];
    if (Number.isFinite(media.averageScore)) info.push(`AniList score: ${media.averageScore}/100`);
    const next = media.nextAiringEpisode;
    if (next && Number.isInteger(next.episode) && Number.isFinite(next.airingAt) && next.airingAt * 1000 > Date.now()) {
      const when = new Date(next.airingAt * 1000).toLocaleString(undefined,
        { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      info.push(`Episode ${next.episode} airs ${when} (${timeUntil(next.airingAt * 1000 - Date.now())})`);
    }
    const infoBox = document.getElementById("aniInfo");
    if (infoBox && info.length) { infoBox.textContent = info.join(" | "); infoBox.hidden = false; }

    // 1. Extra "Watch on ..." buttons (skip platforms we already show from Jikan)
    const box = document.getElementById("platformsBox");
    if (box) {
      const have = new Set((jikanAnime.streaming || []).map(s => String(s.name || "").toLowerCase()));
      let added = 0;
      (media.externalLinks || []).filter(l => l.type === "STREAMING").forEach(l => {
        const name = String(l.site || "").trim();
        const href = safeUrl(l.url);
        if (!name || !href || have.has(name.toLowerCase())) return;
        have.add(name.toLowerCase());
        box.insertAdjacentHTML("beforeend", `<a class="btn" href="${href}" target="_blank" rel="noopener">Watch on ${esc(name)}</a>`);
        added++;
      });
      const none = document.getElementById("noLinks");
      if (none && added) none.remove();
    }

    // 2. Links to individual episodes on official platforms (not every anime has these)
    const eps = (media.streamingEpisodes || [])
      .map(e => ({ title: e.title, site: e.site, url: safeUrl(e.url), thumb: safeUrl(e.thumbnail) }))
      .filter(e => e.url)
      .slice(0, 100);
    const section = document.getElementById("aniEps");
    if (section && eps.length) {
      document.getElementById("aniEpList").innerHTML = eps.map(e => `
        <li class="aniep${e.thumb ? "" : " nothumb"}">
          ${e.thumb ? `<img class="epthumb" src="${e.thumb}" alt="" loading="lazy" width="96" height="54">` : ""}
          <span class="eptitle">${esc(e.title || "Episode")}<small class="muted">${esc(e.site || "")}</small></span>
          <span class="epbtns"><a class="btn small ghost" href="${e.url}" target="_blank" rel="noopener">Watch${e.site ? " on " + esc(e.site) : ""}</a></span>
        </li>`).join("");
      section.hidden = false;
    }
  } catch (e) {
    // These links are a bonus. If AniList is slow or down, the page still works without them.
  }
}

async function showWatch(id) {
  rememberView();
  currentView = "watch";
  window.scrollTo(0, 0);
  app.innerHTML = watchSkeleton();
  try {
    const a = await getJSON(`/anime/${id}/full`);
    addRecent(a);
    const official = OFFICIAL[id];
    let src = "", note = "";
    if (official && official.type === "playlist") {
      src = `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(official.id)}`;
    } else if (official && official.type !== "episodes") {
      src = `https://www.youtube.com/embed/${encodeURIComponent(official.id)}`;
    } else if (a.trailer && a.trailer.embed_url) {
      src = a.trailer.embed_url;
      note = "Showing the official trailer. Full episodes: use the buttons below.";
    }
    const platforms = (a.streaming || []).filter(s => safeUrl(s.url))
      .map(s => `<a class="btn" href="${safeUrl(s.url)}" target="_blank" rel="noopener">Watch on ${esc(s.name)}</a>`).join("");
    app.innerHTML = `
      <button class="back" id="back">&larr; Back</button>
      <section class="watch">
        <h2>${esc(a.title)}</h2>
        <div id="playerBox">${src ? playerHTML(src, "Official video") : ""}</div>
        <p class="muted" id="playerNote">${esc(note)}</p>
        <div id="platformsBox">
          <button class="btn" id="saveBtn"></button>
          ${platforms || '<p class="muted" id="noLinks">No streaming links listed yet.</p>'}
        </div>
        <p>${esc(a.synopsis || "No synopsis available.")}</p>
        <p class="muted">${esc(a.type || "")} | ${a.episodes ?? "?"} episodes | Score ${a.score ?? "N/A"}</p>
        <p class="muted" id="aniInfo" hidden></p>
        <section aria-labelledby="epTitle">
          <h3 id="epTitle">Episodes</h3>
          <div id="epProgress" class="epprogress"></div>
          <p id="epResume"></p>
          <ul class="eplist" id="epList"><li class="muted">Loading episodes...</li></ul>
          <div id="epMore"></div>
        </section>
        <section id="aniEps" aria-labelledby="aniEpsTitle" hidden>
          <h3 id="aniEpsTitle">Watch episodes on official platforms <small class="muted">(links from AniList)</small></h3>
          <ul class="eplist" id="aniEpList"></ul>
        </section>
      </section>`;
    document.getElementById("back").addEventListener("click", goBack);

    // Save / Remove button
    const saveBtn = document.getElementById("saveBtn");
    const refreshBtn = () => {
      const isSaved = !!loadList()[a.mal_id];
      saveBtn.textContent = isSaved ? "Saved (click to remove)" : "Add to watchlist";
      saveBtn.classList.toggle("saved", isSaved);
    };
    saveBtn.addEventListener("click", () => {
      const list = loadList();
      if (list[a.mal_id]) delete list[a.mal_id];
      else list[a.mal_id] = { id: a.mal_id, title: a.title, image: a.images.jpg.image_url };
      saveList(list);
      refreshBtn();
    });
    refreshBtn();

    // Episode list (loaded after the page shows, so the main info appears fast)
    watchId = String(id);
    watchTotal = a.episodes || 0;
    setTimeout(() => loadEpisodes(String(id), 1), 400); // small delay to stay under Jikan's rate limit
    loadAniList(String(id), a); // AniList is a different service, so it has its own rate limit
  } catch (e) {
    showError(app, e, () => showWatch(id), goBack);
  }
}

function showWatchlist() {
  currentView = "watchlist";
  savedView = null;
  const items = Object.values(loadList());
  if (!items.length) {
    app.innerHTML = '<p class="muted">Your watchlist is empty. Open an anime and press "Add to watchlist".</p>';
    return;
  }
  app.innerHTML = '<h2>My Watchlist</h2><div class="grid">' + items.map(a => `
    <button class="card" data-id="${a.id}">
      <img src="${a.image}" alt="" loading="lazy">
      <span>${esc(a.title)}${watchlistNote(a.id)}</span>
    </button>`).join("") + "</div>";
  app.querySelectorAll(".card").forEach(c => c.addEventListener("click", () => showWatch(c.dataset.id)));
}
document.getElementById("listBtn").addEventListener("click", showWatchlist);

// GENRES: buttons loaded from Jikan. Clicking one filters the catalog by that genre.
const genreBar = document.getElementById("genres");

function markGenre() {
  genreBar.querySelectorAll(".chip").forEach(c =>
    c.setAttribute("aria-pressed", String(c.dataset.id === String(currentGenre))));
}

async function loadGenres() {
  try {
    const genres = await getJSON("/genres/anime?filter=genres");
    genreBar.innerHTML = genres.map(g => `<button class="chip" data-id="${g.mal_id}" aria-pressed="false">${esc(g.name)}</button>`).join("");
    genreBar.querySelectorAll(".chip").forEach(chip => chip.addEventListener("click", () => {
      // Click the same genre again to turn the filter off
      currentGenre = currentGenre === chip.dataset.id ? null : chip.dataset.id;
      currentTab = currentGenre ? null : "top";
      document.getElementById("search").value = ""; closeSuggest();
      markGenre(); markTab();
      showCatalog();
    }));
  } catch (e) {
    genreBar.innerHTML = ""; // genres are optional, so the site still works without them
  }
}

// Search with a small delay so we don't spam the API (Jikan has rate limits)
let timer;
document.getElementById("search").addEventListener("input", e => {
  clearTimeout(timer);
  const q = e.target.value.trim();
  currentGenre = null;
  currentTab = q ? null : "top";
  markGenre(); markTab();
  timer = setTimeout(() => showCatalog(q), 500);
});
const home = document.getElementById("home");
home.addEventListener("click", () => {
  document.getElementById("search").value = ""; closeSuggest();
  currentGenre = null; currentTab = "top";
  markGenre(); markTab(); showCatalog();
});

// RANDOM ANIME: asks Jikan for a random title and opens its watch page.
// Adult-rated titles are skipped (we ask again, up to 5 times).
async function showRandom() {
  const btn = document.getElementById("randomBtn");
  hideBanner();
  btn.disabled = true;
  try {
    for (let tries = 0; tries < 5; tries++) {
      const a = await getJSON("/random/anime");
      const adult = (a.rating || "").startsWith("Rx") || (a.explicit_genres || []).length > 0;
      if (!adult) { await showWatch(String(a.mal_id)); return; }
      await new Promise(r => setTimeout(r, 400)); // short pause to stay under Jikan's rate limit
    }
    showBanner("Couldn't find a suitable anime right now. Try again.");
  } catch (e) {
    showBanner(friendlyError(e));
  } finally {
    btn.disabled = false;
  }
}
document.getElementById("randomBtn").addEventListener("click", showRandom);

// Sort dropdown
document.getElementById("sort").addEventListener("change", e => {
  currentSort = e.target.value;
  showCatalog(document.getElementById("search").value.trim());
});

// Tab buttons: Top / Airing / Upcoming
document.querySelectorAll("#tabs .tab").forEach(tab => tab.addEventListener("click", () => {
  currentTab = tab.dataset.tab;
  currentGenre = null;
  document.getElementById("search").value = ""; closeSuggest();
  markGenre(); markTab(); showCatalog();
}));
home.addEventListener("keydown", e => { if (e.key === "Enter") home.click(); });

// Clicks inside the Recently viewed row (one listener on #app, so it survives the page being swapped)
app.addEventListener("click", e => {
  const card = e.target.closest("#recent .card");
  if (card) { showWatch(card.dataset.id); return; }
  if (e.target.closest("#clearRecent")) {
    try { localStorage.removeItem("divanime-recent"); } catch (err) { /* ignore */ }
    refreshRecent();
  }
});

// SEARCH SUGGESTIONS: while you type, show up to 5 matching titles under the search box.
// Mouse: click one. Keyboard: Arrow Up/Down to move, Enter to open, Escape to close.
const searchInput = document.getElementById("search");
const suggestBox = document.getElementById("suggest");
let suggestTimer, suggestToken = 0, suggestItems = [], suggestIndex = -1;

function closeSuggest() {
  suggestToken++; // ignore any suggestion request still on its way
  suggestBox.hidden = true;
  suggestBox.innerHTML = "";
  suggestItems = [];
  suggestIndex = -1;
  searchInput.setAttribute("aria-expanded", "false");
  searchInput.removeAttribute("aria-activedescendant");
}

function renderSuggest() {
  suggestBox.innerHTML = suggestItems.map((a, i) => `
    <li role="option" id="sg${i}" data-id="${a.mal_id}" aria-selected="${i === suggestIndex}">
      <img src="${a.images.jpg.small_image_url || a.images.jpg.image_url}" alt="">
      <span>${esc(a.title)}</span>
    </li>`).join("");
  suggestBox.hidden = !suggestItems.length;
  searchInput.setAttribute("aria-expanded", String(suggestItems.length > 0));
  if (suggestIndex >= 0) searchInput.setAttribute("aria-activedescendant", "sg" + suggestIndex);
  else searchInput.removeAttribute("aria-activedescendant");
}

async function fetchSuggestions(text) {
  const token = ++suggestToken;
  try {
    const list = await getJSON(`/anime?q=${encodeURIComponent(text)}&limit=5&sfw=true`);
    if (token !== suggestToken || searchInput.value.trim() !== text) return; // outdated answer
    suggestItems = list;
    suggestIndex = -1;
    renderSuggest();
  } catch (e) {
    closeSuggest(); // suggestions are optional, so fail quietly
  }
}

function pickSuggestion(id) {
  closeSuggest();
  clearTimeout(timer); // cancel the normal search that was about to run
  showWatch(String(id));
}

searchInput.addEventListener("input", () => {
  clearTimeout(suggestTimer);
  const text = searchInput.value.trim();
  if (text.length < 2) { closeSuggest(); return; }
  suggestTimer = setTimeout(() => fetchSuggestions(text), 300);
});

searchInput.addEventListener("keydown", e => {
  if (suggestBox.hidden) return;
  const n = suggestItems.length;
  if (e.key === "ArrowDown") { e.preventDefault(); suggestIndex = (suggestIndex + 1) % n; renderSuggest(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); suggestIndex = (suggestIndex - 1 + n) % n; renderSuggest(); }
  else if (e.key === "Enter" && suggestIndex >= 0) { e.preventDefault(); pickSuggestion(suggestItems[suggestIndex].mal_id); }
  else if (e.key === "Escape") closeSuggest();
});

suggestBox.addEventListener("mousedown", e => e.preventDefault()); // keep focus in the search box
suggestBox.addEventListener("click", e => {
  const li = e.target.closest("li");
  if (li) pickSuggestion(li.dataset.id);
});
searchInput.addEventListener("blur", closeSuggest);

// EXPORT / IMPORT: back up your watchlist, last-opened episodes, and watched episodes as a JSON file.
const dataMsg = document.getElementById("dataMsg");

function exportData() {
  const data = {
    app: "DIVAnime",
    version: 1,
    exportedAt: new Date().toISOString(),
    list: loadList(),
    progress: loadProgress(),
    watched: loadWatchedAll(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "divanime-data.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  dataMsg.textContent = "Exported divanime-data.json. Keep it somewhere safe.";
}

// Never trust a file blindly: only accept the exact shapes we expect.
// (Images must come from MyAnimeList's CDN, because they are placed into the page.)
const isPosInt = n => Number.isInteger(n) && n > 0;
const isId = s => /^\d{1,9}$/.test(s);
const IMAGE_OK = /^https:\/\/cdn\.myanimelist\.net\/[\w\/.\-]+$/;

function importData(file) {
  if (!file) return;
  if (file.size > 1000000) { dataMsg.textContent = "That file is too big to be a DIVAnime backup."; return; }
  const reader = new FileReader();
  reader.onerror = () => { dataMsg.textContent = "Could not read that file."; };
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || data.app !== "DIVAnime") throw new Error("not a DIVAnime backup");
      let nList = 0, nProgress = 0, nWatched = 0;

      // Watchlist: add new titles
      const list = loadList();
      for (const [id, item] of Object.entries(data.list || {})) {
        if (isId(id) && item && typeof item.title === "string" && typeof item.image === "string" && IMAGE_OK.test(item.image)) {
          list[id] = { id: Number(id), title: item.title.slice(0, 300), image: item.image };
          nList++;
        }
      }
      saveList(list);

      // Last opened episode: the imported value wins
      for (const [id, ep] of Object.entries(data.progress || {})) {
        if (isId(id) && isPosInt(ep)) { saveProgress(id, ep); nProgress++; }
      }

      // Watched episodes: combine with what you already have
      for (const [id, eps] of Object.entries(data.watched || {})) {
        if (!isId(id) || !Array.isArray(eps)) continue;
        const set = new Set(getWatched(id));
        eps.slice(0, 5000).forEach(n => { if (isPosInt(n)) set.add(n); });
        setWatched(id, [...set].sort((a, b) => a - b));
        nWatched++;
      }

      dataMsg.textContent = `Imported ${nList} watchlist titles, ${nProgress} last-opened marks, and watched episodes for ${nWatched} anime.`;
      updateCount();
      if (currentView === "watchlist") showWatchlist();
    } catch (e) {
      dataMsg.textContent = "That file is not a valid DIVAnime backup. Nothing was changed.";
    }
  };
  reader.readAsText(file);
}

document.getElementById("exportBtn").addEventListener("click", exportData);
document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", e => {
  importData(e.target.files[0]);
  e.target.value = ""; // lets you pick the same file again later
});

// THEME PICKER: Night / Day / Sunset. The colors live in style.css as CSS variables.
const themeSelect = document.getElementById("theme");
themeSelect.value = document.documentElement.getAttribute("data-theme") || "night";
themeSelect.addEventListener("change", () => {
  document.documentElement.setAttribute("data-theme", themeSelect.value);
  try { localStorage.setItem("divanime-theme", themeSelect.value); } catch (e) { /* ignore */ }
});

updateCount();
markTab();
showCatalog();
setTimeout(loadGenres, 600); // small delay to stay under Jikan's rate limit
