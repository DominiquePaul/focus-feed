# Chrome Web Store listing

Copy these into the developer dashboard (https://chrome.google.com/webstore/devconsole).

## Store listing

**Name:** Focus Feed

**Summary** (max 132 characters):
Hides the X and LinkedIn feeds and notifications. Posting and messages still work. Unlocking takes 15 seconds.

**Category:** Productivity. **Language:** English.

**Description:**

Focus Feed turns the X and LinkedIn feeds off by default. You can still post, read your messages and look people up. The feed is just not there when you open the site.

- Hides the feed and notifications on X and LinkedIn. Posting and messages keep working.
- Unlocking takes 15 seconds of staying on the page. Switching tabs or apps resets the timer.
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
Reduces distraction on X and LinkedIn by hiding the feed and notifications until the user deliberately unlocks them.

**Permission justification, `storage`:**
Saves whether the feed is unlocked (so it stays unlocked across tabs and reloads until 6 AM) and the local daily counts shown in the statistics popup.

**Host permission justification (x.com, twitter.com, linkedin.com):**
The content script hides the feed and notification elements on these sites and shows the unlock card. It runs on no other sites.

**Remote code:** No, I am not using remote code. All code is in the package.

**Data usage:** tick none of the data types. Certify all three statements (not sold, not used for unrelated purposes, not used for creditworthiness).

**Privacy policy URL:** https://github.com/DominiquePaul/focus-feed/blob/main/PRIVACY.md
