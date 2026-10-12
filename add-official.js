// Helper for making lines for official.js. It runs only in your browser.

const VIDEO_ID = /^[\w-]{11}$/;
const LIST_ID = /^[\w-]{10,64}$/;
const YT_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtube-nocookie.com"];

// "https://myanimelist.net/anime/1535/Death_Note" or "1535" -> "1535" (or null)
function parseMalId(text) {
  const t = String(text || "").trim();
  if (/^\d{1,9}$/.test(t)) return t;
  const m = t.match(/myanimelist\.net\/anime\/(\d{1,9})/);
  return m ? m[1] : null;
}

// A YouTube link or ID -> { type: "video" | "playlist", id } (or null if it is not valid)
function parseYouTube(text) {
  const t = String(text || "").trim();
  if (VIDEO_ID.test(t)) return { type: "video", id: t }; // a bare video ID
  let url;
  try { url = new URL(t); } catch (e) { return null; }
  if (!YT_HOSTS.includes(url.hostname)) return null;

  if (url.hostname === "youtu.be") {
    const id = url.pathname.slice(1);
    return VIDEO_ID.test(id) ? { type: "video", id } : null;
  }
  const embed = url.pathname.match(/^\/embed\/([\w-]{11})$/);
  if (embed) return { type: "video", id: embed[1] };

  const v = url.searchParams.get("v");
  const list = url.searchParams.get("list");
  if (url.pathname === "/playlist" && list && LIST_ID.test(list)) return { type: "playlist", id: list };
  if (v && VIDEO_ID.test(v)) return { type: "video", id: v };
  if (list && LIST_ID.test(list)) return { type: "playlist", id: list };
  return null;
}

// The optional label ("Tagalog dub"): keep only safe characters, so it cannot break the line
function cleanLang(text) {
  return String(text || "").replace(/[\u0000-\u001f"'\\`<>]/g, "").trim().slice(0, 30);
}

// Builds the text to paste into official.js
function buildSingleLine(mal, yt, lang) {
  const label = cleanLang(lang);
  return `${mal}: { type: "${yt.type}", id: "${yt.id}"${label ? `, lang: "${label}"` : ""} },`;
}
function buildEpisodesLine(mal, eps, lang) { // eps: [[number, id], ...]
  const label = cleanLang(lang);
  const rows = eps.map(([n, id]) => `    ${n}: "${id}",`).join("\n");
  return `${mal}: { type: "episodes",${label ? ` lang: "${label}",` : ""} list: {\n${rows}\n  } },`;
}

// Reads the textarea. Returns { eps: [[n, id], ...], bad: [line numbers that could not be read] }
function parseEpisodeLines(text) {
  const eps = [], bad = [];
  String(text || "").split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    const m = line.trim().match(/^(\d{1,4})\s+(.+)$/);
    const yt = m && parseYouTube(m[2]);
    if (yt && yt.type === "video") eps.push([Number(m[1]), yt.id]); else bad.push(i + 1);
  });
  eps.sort((a, b) => a[0] - b[0]);
  return { eps, bad };
}

function previewSrc(yt) {
  return yt.type === "playlist"
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(yt.id)}`
    : `https://www.youtube.com/embed/${encodeURIComponent(yt.id)}`;
}

// ---- Page wiring (only when the page elements exist) ----
if (typeof document !== "undefined" && document.getElementById("makeBtn")) {
  const $ = id => document.getElementById(id);
  const msg = $("msg");

  document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener("change", () => {
    const episodes = document.querySelector('input[name="mode"]:checked').value === "episodes";
    $("singleBox").hidden = episodes;
    $("epsBox").hidden = !episodes;
  }));

  $("makeBtn").addEventListener("click", () => {
    $("result").hidden = true;
    const mal = parseMalId($("mal").value);
    if (!mal) { msg.textContent = "I couldn't find the anime ID. Paste its MyAnimeList link (or just the number)."; return; }

    const episodes = document.querySelector('input[name="mode"]:checked').value === "episodes";
    let line, first;
    if (!episodes) {
      const yt = parseYouTube($("yt").value);
      if (!yt) { msg.textContent = "That doesn't look like a YouTube video or playlist link."; return; }
      line = buildSingleLine(mal, yt, $("lang").value);
      first = yt;
    } else {
      const { eps, bad } = parseEpisodeLines($("eps").value);
      if (bad.length) { msg.textContent = "I couldn't read line " + bad.join(", ") + ". Use: number, space, link."; return; }
      if (!eps.length) { msg.textContent = "Add at least one episode line."; return; }
      line = buildEpisodesLine(mal, eps, $("lang").value);
      first = { type: "video", id: eps[0][1] };
    }

    msg.textContent = "";
    $("out").textContent = line;
    $("preview").innerHTML = `<iframe class="player" src="${previewSrc(first)}" title="Preview" allowfullscreen></iframe>`;
    $("result").hidden = false;
  });

  $("copyBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("out").textContent);
      msg.textContent = "Copied. Now paste it inside OFFICIAL in official.js.";
    } catch (e) {
      msg.textContent = "Could not copy automatically. Select the text and copy it yourself.";
    }
  });
}
