# DIVAnime

A simple anime catalog and watch-page website built with plain HTML, CSS, and JavaScript. No frameworks, no build step, no API key.

DIVAnime only links to and embeds **legal** sources: official trailers, official YouTube uploads, and links to licensed streaming platforms. It does not host or provide pirated episodes.

<!-- Add a screenshot here after you run the site:
1. Make a folder named "screenshots" and save an image, for example screenshots/home.png
2. Then replace this comment with: ![DIVAnime home page](screenshots/home.png)
-->

<!-- After deploying, add your live link here:
**Live demo:** https://YOUR-USERNAME.github.io/DIVAnime/
-->

## Features

- Catalog with poster cards and three tabs: Top, Airing now, Upcoming
- Sort dropdown: Default, Highest score, Most popular, Newest, A to Z
- "Load more" button (pagination), 24 titles at a time
- Search by title
- Genre filter buttons (click again to clear)
- Watch page with synopsis, type, episode count, and score
- Episode list on every watch page (title, air date, link to details), with a "Show more episodes" button
- Official trailer embed and "Watch on ..." buttons for legal streaming platforms
- Continue watching: the last episode you opened is marked, with a "Jump to it" button (also shown in your watchlist)
- Watched checkboxes with a progress bar ("Watched 5 of 24"), plus "Mark loaded as watched" and "Clear" buttons
- Loading skeletons (gray placeholder cards) while data loads
- Export / import your watchlist and progress as a JSON file (footer buttons), to back up or move to another device
- **Random** button opens a random (non-adult) anime
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
DIVanime/
├── index.html   # page structure
├── style.css    # styling and theme colors (CSS variables)
├── theme.js     # applies the saved theme before the page draws
├── logo.svg     # logo and favicon
├── LICENSE      # MIT license
├── .gitignore   # files Git should skip
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
- For full series, add each episode: `20: { type: "episodes", list: { 1: "YOUTUBE_ID_EP1", 2: "YOUTUBE_ID_EP2" } }`. Episodes with an ID get a **Play** button in the episode list that loads that video in the player.
- Only use videos the channel owner has made publicly embeddable.

## Tech used

- HTML, CSS, JavaScript (vanilla)
- [Jikan API](https://docs.api.jikan.moe) (unofficial MyAnimeList API)
- Google Fonts (Zen Maru Gothic)

## Credits

- Anime data comes from [Jikan](https://jikan.moe), an unofficial API for MyAnimeList. DIVAnime is not affiliated with MyAnimeList or Jikan.
- Posters, trailers, and synopses belong to their respective owners.

## License

MIT. See the `LICENSE` file.

## Your data

Your watchlist, last-opened episodes, watched episodes, and theme are saved in your browser (`localStorage`). Nothing is sent to a server. Clearing your browser data erases them, so use **Export data** in the footer to keep a backup.

## Notes

- Jikan has rate limits (about 3 requests per second), so search waits half a second after you stop typing.
- Anime data, posters, and trailers belong to their respective owners. This project is for learning purposes.

## Ideas for next steps

- Offline message with a retry button

## Tagalog summary

Ang DIVAnime ay simpleng anime website gamit ang HTML, CSS, at JavaScript. Buksan lang ang `index.html` sa browser. May catalog (Top, Airing, Upcoming), Load more, sort, search, genre filters, watchlist, 3 themes, episode list, Random button, continue watching, watched checkboxes, at watch page na may trailer at links sa legal na streaming sites. Para sa buong episodes, ilagay ang YouTube ID mula sa official channels sa `OFFICIAL` object sa `script.js`.
