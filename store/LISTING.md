# Chrome Web Store listing

Copy these into the developer dashboard (https://chrome.google.com/webstore/devconsole).

## Store listing

**Name:** Focus Feed

**Summary** (max 132 characters):
Hides X, LinkedIn and Instagram feeds. Keeps messages and profile browsing. Instagram feeds stay off.

**Category:** Productivity. **Language:** English.

**Description:**

Focus Feed hides feeds on X, LinkedIn and Instagram. You can still read your messages and look people up. X and LinkedIn have a timed unlock. Instagram feeds stay off.

- Hides the feed and notifications on X and LinkedIn. Posting and messages keep working.
- Instagram keeps messages, account search and profiles available. Home, Explore recommendations, Reels, Stories and notifications stay hidden.
- On X and LinkedIn, unlocking takes 15 seconds of staying on the page. Switching tabs or apps resets the timer.
- Once unlocked, the feed and notifications stay on until you click Hide feed.
- Every morning at 6 AM, everything is hidden again.
- The toolbar popup shows how many sessions were blocked and roughly how much time you won back.

No accounts, no tracking, no network requests. All data stays on your device.

Open source: https://github.com/DominiquePaul/focus-feed

**Graphics** (all in this folder):
- Icon: `icons/icon128.png`
- Screenshots (1280x800): `screenshot-1-locked.png` to `screenshot-4-stats.png`
- Small promo tile (440x280): `promo-small-440x280.png`
- Marquee (1400x560, optional): `promo-marquee-1400x560.png`

**Homepage / support URL:** https://github.com/DominiquePaul/focus-feed

## Privacy practices tab

**Single purpose:**
Reduces distraction by hiding feeds and notifications on X, LinkedIn and Instagram. Instagram keeps messages, account search and profiles available. X and LinkedIn can be unlocked after a delay.

**Permission justification, `storage`:**
Saves whether the feed is unlocked (so it stays unlocked across tabs and reloads until 6 AM) and the local daily counts shown in the statistics popup.

**Host permission justification (x.com, twitter.com, linkedin.com, instagram.com):**
The content scripts hide feed and notification elements on these sites. X and LinkedIn show an unlock card. Instagram shows shortcuts to messages and account search. It runs on no other sites.

**Remote code:** No, I am not using remote code. All code is in the package.

**Data usage:** tick none of the data types. Certify all three statements (not sold, not used for unrelated purposes, not used for creditworthiness).

**Privacy policy URL:** https://github.com/DominiquePaul/focus-feed/blob/main/PRIVACY.md
