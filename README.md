# Route → GPX

A minimal, mobile-first web app that converts Google Maps routes to GPX files for Wahoo bike computers.

**The problem:** Google Maps is the easiest way to plan a route on your phone, but there's no way to send that route to a bike computer. This app bridges the gap.

**The workflow:**
1. Plan a route in Google Maps
2. Share → Copy link
3. Paste into Route → GPX
4. Tap "Open in Wahoo app" → it syncs to your ELEMNT via Bluetooth

## Setup

### Google API Key (required)

The app uses Google's Directions API to fetch route geometry. You need a free API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (e.g. "Route GPX")
3. Go to **APIs & Services → Library**
4. Enable **Directions API** and **Maps JavaScript API**
5. Go to **APIs & Services → Credentials**
6. Click **Create Credentials → API Key**
7. Copy the key — you'll paste it into the app on first use

Google gives you $200/month of free credit. Each conversion costs ~$0.005–0.01, so this is effectively free for personal use.

### Deploy to Vercel

The app needs HTTPS for Android's Web Share API (the "Open in Wahoo" button). Easiest way:

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the GitHub repo
4. Deploy — no build settings needed, it auto-detects the static site

You'll get a URL like `route-to-gpx.vercel.app`. On your phone, open it in Chrome and tap **⋮ → Add to Home screen** to make it feel like a native app.

## Technical notes

- Single HTML file, no build step, no dependencies
- Uses Google Maps JavaScript API + DirectionsService client-side
- API key stays on your device — nothing is sent to any server except Google's API
- GPX output is a standard 1.1 track file compatible with Wahoo, Garmin, Komoot, etc.
- Web Share API (Level 2) for file sharing to the Wahoo app on Android
- Dark theme, designed for mobile use

## Limitations

- Shortened Google Maps URLs (`maps.app.goo.gl`) need to be expanded first — open in Chrome and copy the full URL from the address bar
- Google Maps directions are limited to 25 waypoints
- Route geometry comes from Google's cycling/driving/walking directions, not from cycling-specific routing (no surface type awareness)
- The GPX contains a track (path) but not turn-by-turn cue sheet entries — the Wahoo will generate its own turn-by-turn from the track shape
