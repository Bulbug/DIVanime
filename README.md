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
- Search by title, with suggestions while you type (mouse or keyboard: arrows, Enter, Escape)
- Genre filter buttons (click again to clear)
- Watch page with synopsis, type, episode count, and score
- Episode list on every watch page (title, air date, link to details), with a "Show more episodes" button
- Official trailer embed and "Watch on ..." buttons for legal streaming platforms (from Jikan and AniList)
- AniList score, and the date and time of the next episode for shows that are still airing (shown in your own time zone)
- "Watch episodes on official platforms": links to individual episodes on licensed platforms such as Crunchyroll, from AniList (not every anime has them)
- Continue watching: the last episode you opened is marked, with a "Jump to it" button (also shown in your watchlist)
- Watched checkboxes with a progress bar ("Watched 5 of 24"), plus "Mark loaded as watched" and "Clear" buttons
- "Recently viewed" row above the catalog (your last 8 anime, with a Clear button)
- Loading skeletons (gray placeholder cards) while data loads
- Export / import your watchlist and progress as a JSON file (footer buttons), to back up or move to another device
- Friendly error messages with a "Try again" button, and an offline banner (it retries by itself when you reconnect)
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
├── script.js    # API calls, tabs, search, genres, sorting, pagination, watchlist, progress, export/import
├── official.js  # your list of official YouTube episodes (the only file you edit to add videos)
├── add-official.html  # helper page that makes the lines for official.js
├── add-official.js    # code for the helper page
├── theme.js     # applies the saved theme before the page draws
├── logo.svg     # logo and favicon
├── LICENSE      # MIT license
├── .gitignore   # files Git should skip
└── README.md
```

## Adding official full episodes

DIVAnime can play full episodes, but only from **official** YouTube channels (for example Ani-One Asia, Ani-One Philippines, or Muse Asia). Many titles are not free or not available in every country, so check each one.

The easy way:

1. Open `add-official.html` in your browser.
2. Paste the anime's MyAnimeList link (for example `myanimelist.net/anime/1535/...`).
3. Paste the official YouTube link: one video or playlist, or one link per episode.
4. Check the **preview**. If it says "Video unavailable" or only "Watch on YouTube", embedding is blocked or it is not available in your country, so don't add it.
5. Copy the line it makes and paste it inside `OFFICIAL` in `official.js`.

What a finished `official.js` can look like:

```js
const OFFICIAL = {
  1535: { type: "video", id: "YOUTUBE_VIDEO_ID" },          // one video (for example a full-season upload)
  5114: { type: "playlist", id: "YOUTUBE_PLAYLIST_ID" },    // a playlist
  20: { type: "episodes", list: { 1: "YOUTUBE_ID_EP1", 2: "YOUTUBE_ID_EP2" } },  // one video per episode
};
```

- Episodes in an `episodes` entry get a **Play** button in the episode list that loads that video in the player.
- Anime without an entry show the official trailer and "Watch on ..." links to licensed platforms.

## Tech used

- HTML, CSS, JavaScript (vanilla)
- [Jikan API](https://docs.api.jikan.moe) (unofficial MyAnimeList API) for the catalog, episodes, and details
- [AniList GraphQL API](https://docs.anilist.co) for extra links to legal streaming platforms (no API key needed)
- Google Fonts (Zen Maru Gothic)

## Credits

- Anime data comes from [Jikan](https://jikan.moe), an unofficial API for MyAnimeList, and streaming links come from [AniList](https://anilist.co). DIVAnime is not affiliated with MyAnimeList, Jikan, or AniList.
- Posters, trailers, and synopses belong to their respective owners.

## Your data

Your watchlist, last-opened episodes, watched episodes, recently viewed list, and theme are saved in your browser (`localStorage`). Nothing is sent to a server. Clearing your browser data erases them, so use **Export data** in the footer to keep a backup.

## Notes

- AniList failing never breaks a page: its links are a bonus. Jikan has rate limits (about 3 requests per second), so search waits half a second after you stop typing.
- "Newest" sorting hides titles that have not aired yet (except on the Upcoming tab).
- This project is for learning purposes.

## Ideas for next steps

- Keyboard shortcuts (for example "/" to focus the search box)

## License

MIT. See the `LICENSE` file.

## Tagalog summary

Ang DIVAnime ay simpleng anime website gamit ang HTML, CSS, at JavaScript. Buksan lang ang `index.html` sa browser. May catalog (Top, Airing, Upcoming), Load more, sort, search na may suggestions, genre filters, watchlist, 3 themes, episode list, Random button, continue watching, watched checkboxes, "Recently viewed", export/import ng data, offline message, at watch page na may trailer at links sa legal na streaming sites. Para sa buong episodes, buksan ang `add-official.html`, gumawa ng linya mula sa official YouTube link, at ilagay sa `official.js`.
