# DIVAnime

A simple anime catalog and watch-page website built with plain HTML, CSS, and JavaScript. No frameworks, no build step, no API key.

DIVAnime only links to and embeds **legal** sources: official trailers, official YouTube uploads, and links to licensed streaming platforms. It does not host or provide pirated episodes.

## Features

- Catalog with poster cards and three tabs: Top, Airing now, Upcoming
- "Load more" button (pagination), 24 titles at a time
- Search by title
- Genre filter buttons (click again to clear)
- Watch page with synopsis, type, episode count, and score
- Official trailer embed and "Watch on ..." buttons for legal streaming platforms
- Back button returns you to the same place in the list (loaded pages and scroll position are kept)
- Custom logo and three themes (Night, Day, Sunset) that you can switch in the header, saved in your browser
- Watchlist saved in your browser (`localStorage`), so it stays after refresh

## Getting started

1. Download or clone this repository.
2. Open `index.html` in your browser (Chrome, Edge, or Firefox).

That's it. You need an internet connection because the data comes from the Jikan API.

Optional: run a local server instead (some browsers handle `localStorage` better this way):

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Project structure

```
DIVAnime/
├── index.html   # page structure
├── style.css    # styling and theme colors (CSS variables)
├── theme.js     # applies the saved theme before the page draws
├── logo.svg     # logo and favicon
├── script.js    # API calls, tabs, search, genres, pagination, watchlist
└── README.md
```

## Adding official full episodes

Open `script.js` and find the `OFFICIAL` object near the top. Add a line using the anime's MyAnimeList ID and a YouTube ID from an **official** channel (for example Ani-One Asia or Muse Asia):

```js
const OFFICIAL = {
  1535: { type: "video", id: "YOUTUBE_VIDEO_ID" },
  5114: { type: "playlist", id: "YOUTUBE_PLAYLIST_ID" },
};
```

- The MyAnimeList ID is the number in the anime's MAL URL (`myanimelist.net/anime/1535/...`).
- The YouTube video ID is the part after `watch?v=` in the video URL.
- Only use videos the channel owner has made publicly embeddable.

## Tech used

- HTML, CSS, JavaScript (vanilla)
- [Jikan API](https://docs.api.jikan.moe) (unofficial MyAnimeList API)
- Google Fonts (Zen Maru Gothic)

## Notes

- Jikan has rate limits (about 3 requests per second), so search waits half a second after you stop typing.
- Anime data, posters, and trailers belong to their respective owners. This project is for learning purposes.

## Ideas for next steps

- Sort options (score, popularity, newest)
- Episode list per anime

## Tagalog summary

Ang DIVAnime ay simpleng anime website gamit ang HTML, CSS, at JavaScript. Buksan lang ang `index.html` sa browser. May catalog (Top, Airing, Upcoming), Load more, search, genre filters, watchlist, 3 themes, at watch page na may trailer at links sa legal na streaming sites. Para sa buong episodes, ilagay ang YouTube ID mula sa official channels sa `OFFICIAL` object sa `script.js`.
