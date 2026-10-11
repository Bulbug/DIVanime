// Data source: Jikan API (free, no key) -> https://docs.api.jikan.moe
const API = "https://api.jikan.moe/v4";
const app = document.getElementById("app");
let currentGenre = null; // MAL genre ID as a string, or null for "no filter"

// OPTION A: add official YouTube uploads here (only from official channels like Ani-One Asia / Muse Asia).
// Key = MyAnimeList ID, value = YouTube video or playlist ID.
// Hanapin ang ID sa URL ng YouTube video: youtube.com/watch?v=THIS_PART
const OFFICIAL = {
  // 1535: { type: "video", id: "PASTE_YOUTUBE_VIDEO_ID" },
  // 5114: { type: "playlist", id: "PASTE_YOUTUBE_PLAYLIST_ID" },
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
    if (moreBtn) moreBtn.disabled = false; // in case a request was interrupted
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

// Builds the API URL: search first, then genre, then the selected tab
function buildPath(query, page) {
  let path;
  if (query) path = `/anime?q=${encodeURIComponent(query)}&sfw=true`;
  else if (currentGenre) path = `/anime?genres=${currentGenre}&order_by=score&sort=desc&sfw=true`;
  else path = TAB_PATHS[currentTab || "top"];
  return `${path}&limit=24&page=${page}`;
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
  if (page === 1) app.innerHTML = '<p class="muted">Loading...</p>';
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
        document.getElementById("moreBtn").disabled = true;
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

async function showWatch(id) {
  rememberView();
  currentView = "watch";
  window.scrollTo(0, 0);
  app.innerHTML = '<p class="muted">Loading...</p>';
  try {
    const a = await getJSON(`/anime/${id}/full`);
    const official = OFFICIAL[id];
    let embed = "";
    if (official) {
      const src = official.type === "playlist"
        ? `https://www.youtube.com/embed/videoseries?list=${official.id}`
        : `https://www.youtube.com/embed/${official.id}`;
      embed = `<iframe class="player" src="${src}" title="Official episode" allowfullscreen></iframe>`;
    } else if (a.trailer && a.trailer.embed_url) {
      embed = `<iframe class="player" src="${a.trailer.embed_url}" title="Official trailer" allowfullscreen></iframe>
               <p class="muted">Showing the official trailer. Full episodes: use the buttons below.</p>`;
    }
    const platforms = (a.streaming || []).map(s => `<a class="btn" href="${s.url}" target="_blank" rel="noopener">Watch on ${esc(s.name)}</a>`).join("");
    app.innerHTML = `
      <button class="back" id="back">&larr; Back</button>
      <section class="watch">
        <h2>${esc(a.title)}</h2>
        ${embed}
        <div>
          <button class="btn" id="saveBtn"></button>
          ${platforms || '<p class="muted">No streaming links listed yet.</p>'}
        </div>
        <p>${esc(a.synopsis || "No synopsis available.")}</p>
        <p class="muted">${esc(a.type || "")} | ${a.episodes ?? "?"} episodes | Score ${a.score ?? "N/A"}</p>
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
      <span>${esc(a.title)}</span>
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

// Tab buttons: Top / Airing / Upcoming
document.querySelectorAll("#tabs .tab").forEach(tab => tab.addEventListener("click", () => {
  currentTab = tab.dataset.tab;
  currentGenre = null;
  document.getElementById("search").value = "";
  markGenre(); markTab(); showCatalog();
}));
home.addEventListener("keydown", e => { if (e.key === "Enter") home.click(); });

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
