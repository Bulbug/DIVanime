// Data source: Jikan API (free, no key) -> https://docs.api.jikan.moe
const API = "https://api.jikan.moe/v4";
const app = document.getElementById("app");
let currentGenre = null; // MAL genre ID as a string, or null for "no filter"

// OPTION A: add official YouTube uploads here (only from official channels like Ani-One Asia / Muse Asia).
// Key = MyAnimeList ID, value = YouTube video or playlist ID.
// Hanapin ang ID sa URL ng YouTube video: youtube.com/watch?v=THIS_PART
// Three ways to add one:
//   one video:      { type: "video", id: "YOUTUBE_VIDEO_ID" }
//   a playlist:     { type: "playlist", id: "YOUTUBE_PLAYLIST_ID" }
//   per episode:    { type: "episodes", list: { 1: "YOUTUBE_ID_EP1", 2: "YOUTUBE_ID_EP2" } }
//                   (these get a "Play" button in the episode list)
const OFFICIAL = {
  // 1535: { type: "video", id: "PASTE_YOUTUBE_VIDEO_ID" },
  // 5114: { type: "playlist", id: "PASTE_YOUTUBE_PLAYLIST_ID" },
  // 20:   { type: "episodes", list: { 1: "PASTE_ID", 2: "PASTE_ID" } },
};

// getPage returns the full response (data + pagination info). getJSON returns just the data.
async function getPage(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error("Request failed: " + res.status);
  return res.json();
}
async function getJSON(path) {
  return (await getPage(path)).data;
}

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

async function showCatalog(query = "", page = 1) {
  const myRequest = ++requestId;
  currentView = "catalog";
  savedView = null;
  if (page === 1) app.innerHTML = skeletonGrid();
  try {
    const res = await getPage(buildPath(query, page));
    if (myRequest !== requestId) return; // a newer request replaced this one
    const list = res.data || [];
    if (page > 1 && !document.getElementById("grid")) return; // you left the list while this loaded

    if (page === 1) {
      if (!list.length) { app.innerHTML = '<p class="muted">No results. Try another title.</p>'; return; }
      app.innerHTML = '<div class="grid" id="grid"></div><div id="more"></div>';
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
        showCatalog(query, page + 1);
      });
    } else {
      more.innerHTML = '<p class="muted">You reached the end.</p>';
    }
  } catch (e) {
    if (myRequest !== requestId) return;
    if (page === 1) {
      app.innerHTML = '<p>Could not load anime. Check your internet and try again.</p>';
    } else {
      const more = document.getElementById("more");
      if (!more) return;
      more.innerHTML = '<p>Could not load more.</p><button class="btn" id="retryBtn">Try again</button>';
      document.getElementById("retryBtn").addEventListener("click", () => showCatalog(query, page));
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
    if (page === 1) list.innerHTML = '<li class="muted">Could not load episodes. Try again later.</li>';
    else {
      more.innerHTML = '<p>Could not load more.</p><button class="btn" id="epRetryBtn">Try again</button>';
      document.getElementById("epRetryBtn").addEventListener("click", () => loadEpisodes(id, page));
    }
  }
}

async function showWatch(id) {
  rememberView();
  currentView = "watch";
  window.scrollTo(0, 0);
  app.innerHTML = watchSkeleton();
  try {
    const a = await getJSON(`/anime/${id}/full`);
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
    const platforms = (a.streaming || []).map(s => `<a class="btn" href="${s.url}" target="_blank" rel="noopener">Watch on ${esc(s.name)}</a>`).join("");
    app.innerHTML = `
      <button class="back" id="back">&larr; Back</button>
      <section class="watch">
        <h2>${esc(a.title)}</h2>
        <div id="playerBox">${src ? playerHTML(src, "Official video") : ""}</div>
        <p class="muted" id="playerNote">${esc(note)}</p>
        <div>
          <button class="btn" id="saveBtn"></button>
          ${platforms || '<p class="muted">No streaming links listed yet.</p>'}
        </div>
        <p>${esc(a.synopsis || "No synopsis available.")}</p>
        <p class="muted">${esc(a.type || "")} | ${a.episodes ?? "?"} episodes | Score ${a.score ?? "N/A"}</p>
        <section aria-labelledby="epTitle">
          <h3 id="epTitle">Episodes</h3>
          <div id="epProgress" class="epprogress"></div>
          <p id="epResume"></p>
          <ul class="eplist" id="epList"><li class="muted">Loading episodes...</li></ul>
          <div id="epMore"></div>
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
  } catch (e) {
    app.innerHTML = '<p>Could not load this title. Go back and try again.</p>';
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
      document.getElementById("search").value = "";
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
  document.getElementById("search").value = "";
  currentGenre = null; currentTab = "top";
  markGenre(); markTab(); showCatalog();
});

// RANDOM ANIME: asks Jikan for a random title and opens its watch page.
// Adult-rated titles are skipped (we ask again, up to 5 times).
async function showRandom() {
  const btn = document.getElementById("randomBtn");
  btn.disabled = true;
  try {
    for (let tries = 0; tries < 5; tries++) {
      const a = await getJSON("/random/anime");
      const adult = (a.rating || "").startsWith("Rx") || (a.explicit_genres || []).length > 0;
      if (!adult) { await showWatch(String(a.mal_id)); return; }
      await new Promise(r => setTimeout(r, 400)); // short pause to stay under Jikan's rate limit
    }
    alert("Could not find one right now. Try again.");
  } catch (e) {
    alert("Could not load a random anime. Check your internet and try again.");
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
  document.getElementById("search").value = "";
  markGenre(); markTab(); showCatalog();
}));
home.addEventListener("keydown", e => { if (e.key === "Enter") home.click(); });

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
