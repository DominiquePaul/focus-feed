<img src="docs/banner.png" alt="Focus Feed" width="100%">

A browser extension that hides feeds on X, LinkedIn and Instagram. Messaging and profile browsing keep working. X and LinkedIn have a timed unlock. Instagram feeds stay off.

## Install in 1 minute (Chrome, Arc, Brave, Edge)

1. **[Download Focus Feed](https://github.com/DominiquePaul/focus-feed/archive/refs/heads/main.zip)** and unzip it. Move the `focus-feed-main` folder somewhere you'll keep it, such as Documents, because the browser loads the extension from that folder.
2. Paste `chrome://extensions` into the address bar and turn on **Developer mode** (top right).
3. Drag the `focus-feed-main` folder onto that page. If dragging doesn't work, click **Load unpacked** and pick the folder instead.

That's it. Open LinkedIn, X or Instagram and the feed is gone. Pin the icon in the toolbar to see your stats.

<sub>**Updating:** download again, replace the folder, then click the reload icon on the Focus Feed card in `chrome://extensions`. If you cloned with git, `git pull` and reload instead.</sub>

## Instagram

Instagram has no feed unlock. Home, Explore recommendations, the Reels viewer, Stories and notifications stay hidden. Search still shows accounts, and the inbox, message requests and conversations remain available. Shared media inside conversations stays available too.

Profiles keep their posts, Reels grid and tagged grid. Photo posts opened from the current profile can open in Instagram's post dialog. Direct post links, reloaded post dialogs and the scrolling Reel viewer stay blocked. A blocked page offers shortcuts to messages, account search and the last profile you visited.

Login, two-factor authentication and account settings keep working. The popup lists Instagram as "Always hidden". Visits to blocked content count toward statistics, but account searches do not. Instagram uses the same ten-minute session gap and seven-minute time-saved estimate as X and LinkedIn. Its sessions appear in the existing totals, daily and weekly counts, 14-day chart and on-page statistics. Existing history needs no migration.

## How it works on X and LinkedIn

- **Feeds off.** The feed is hidden on X (Home and Explore, plus the sidebar's trends, "What's happening" and "Live on X") and LinkedIn (home feed and both sidebars). The post composer stays, so you can still post.
- **Notifications off, messages on.** The bell, the red count badges and the `(3)` in the tab title are hidden. Messaging and its badge stay. Unlocking the feed brings the notifications back too, and **Hide feed** hides both again.
- **15 seconds to unlock.** Click **Show feed** and stay on the page. Switching tabs or apps resets the timer.
- **Stays unlocked until you stop it.** Once a feed is unlocked, it stays unlocked across reloads, tabs and restarts. Each site is unlocked separately.
- **One click to hide it again.** A floating **Hide feed** button sits on the unlocked feed.
- **Resets at 6 AM.** Every morning at 06:00, all feeds are hidden again.
- **Statistics.** Click the toolbar icon to see how many sessions were blocked and roughly how much time you got back.

<table>
  <tr>
    <td width="50%"><img src="docs/locked.png" alt="LinkedIn with the feed hidden: only the Start a post box and the Focus Feed card are visible"></td>
    <td width="50%"><img src="docs/countdown.png" alt="The 15-second countdown"></td>
  </tr>
  <tr>
    <td><sub>Feed hidden. Posting still works.</sub></td>
    <td><sub>15 seconds of patience. Leaving the page resets the timer.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/unlocked.png" alt="Unlocked feed with the floating Hide feed button"></td>
    <td>
      <img src="docs/popup.png" alt="Statistics popup, light" width="48%">
      <img src="docs/popup-dark.png" alt="Statistics popup, dark" width="48%">
    </td>
  </tr>
  <tr>
    <td><sub>Unlocked until 06:00, or until you click <b>Hide feed</b>.</sub></td>
    <td><sub>The toolbar popup, in light and dark mode (demo data).</sub></td>
  </tr>
</table>

<sub>The screenshots use a neutral mock page, not real feeds.</sub>

## How the numbers are counted

- **Session blocked:** a visit to a hidden feed. Visits less than 10 minutes apart count as one session, so reloading or clicking around doesn't inflate the count.
- **Time won back:** blocked sessions minus the ones you unlocked anyway, multiplied by 7 minutes. This is an estimate, not a measurement.

All data stays in `chrome.storage.local` on your machine. The extension makes no network requests.

## Configuration

These values are at the top of `shared.js`:

| Setting | Default | What it does |
|---|---|---|
| `UNLOCK_SECONDS` | `15` | How long you have to wait before the feed shows |
| `RESET_HOUR` | `6` | Local hour when unlocked feeds are hidden again |
| `SESSION_GAP_MS` | 10 min | Quiet time needed before a new blocked session is counted |
| `MINUTES_PER_SESSION` | `7` | Estimated minutes saved per blocked session |

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Manifest V3. The only permission is `storage` |
| `shared.js` | Site settings, storage, blocked-session counting and statistics calculations |
| `ui.js` | Shared card styles, bundled fonts and on-page statistics for all three sites |
| `focus.js` | X and LinkedIn page detection, unlock flow and card content |
| `focus.css` | Hiding rules, injected at `document_start` so nothing flashes |
| `instagram.js`, `instagram.css` | Instagram route checks, search and profile exceptions, and feed hiding |
| `tests/` | Browser checks using local fixtures and mocked extension storage |
| `popup.*` | The toolbar popup with statistics and per-site controls |
| `fonts/` | Instrument Serif and JetBrains Mono (SIL Open Font License) |

## When a site changes its markup

X, LinkedIn and Instagram change their pages often.

- **X:** the rules in `focus.css` use `data-testid` attributes, which rarely change.
- **LinkedIn:** class names are randomized, so `focus.js` finds the "Start a post" box by its text and hides everything around it. If it can't find the box, the whole column stays hidden and a **Write a post** button appears instead. If LinkedIn is in a language the extension doesn't recognize, add its wording to `COMPOSER_TEXT` in `focus.js`.

Instagram uses URL paths, semantic navigation elements and search controls instead of generated class names. Unknown routes stay hidden. If Instagram changes its search markup, update `SEARCH` and `markSearchAndNavigation` in `instagram.js` and add a fixture in `tests/browser.js`.

## Development and testing

There is no build step or dependency install. Load this folder as an unpacked extension using the installation steps above. After editing, reload the extension and the affected site tabs.

Run the statistics tests with Node.js 18 or newer:

```sh
node --test tests/shared.test.cjs
```

These check session deduplication, daily rollover, totals across all three sites and compatibility with existing statistics.

Run the local browser checks from the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/tests/browser.html`. The page runs the real content scripts and CSS against synthetic page layouts in an iframe. It checks visibility, dynamic content, navigation, profile post dialogs, messaging controls, video pausing, storage updates, the popup totals and its 14-day chart. It also checks X and LinkedIn hiding rules. Run `http://127.0.0.1:8765/tests/x.html` for X's unlock and relock flow in a top-level page. The test page uses mocked `chrome.storage` and makes no requests to Instagram.

Before releasing, also load the unpacked extension in a signed-in browser and check Home, account search, a public profile, a profile post dialog, the inbox, a conversation, Reels and browser back/forward. Check narrow and wide windows. Fixture tests cannot verify extension injection, Instagram's event handlers or every live layout. Sending a message is not needed for these checks.

## License

MIT, see [LICENSE](LICENSE). The bundled fonts are under the SIL Open Font License (`fonts/OFL-*.txt`).
