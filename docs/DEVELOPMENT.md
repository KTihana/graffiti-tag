# Graffiti Tag

An Android-first community graffiti archive. A tag is a wall; artworks are its successive layers; photographs preserve what was there at a particular time.

## Personal Android APK

For the private version that works without accounts or a development computer, see [personal-android/README.md](../personal-android/README.md). The built APK is `personal-android/artifacts/graffiti-tag-personal-debug.apk`. It uses the same interface with an empty private archive, native camera/gallery/GPS, local photos, and JSON backup export/import. OpenStreetMap and place search need internet; saved photos, records and editing work offline. The personal archive is separate from demo and community data. Nothing is automatically published later.

Install the APK on Android, then export a backup from My archive after adding photographs. This first release has a 50 MB backup-file limit. Keep backups outside the app before uninstalling or clearing app data.

## Try the working local demo

```sh
cd mobile
npm ci
npm run web
```

Open the URL printed by Expo (normally `http://localhost:8081`). The browser preview adapts to phone and desktop screens. Without account credentials it uses OpenStreetMap, clearly identifies itself as a local demo, and stores contributions only on that device/browser. Its sample names, dates, and coordinates are illustrative, not historical claims.

For Android development, run `npm start` in `mobile` and open the project with a compatible Expo Go installation. For a standalone Google Maps APK, follow [SETUP.md](SETUP.md).

## Implemented

- Expo / React Native Android app with Google Maps, map gestures, clustering, street/satellite views, foreground location, place search, filters, and directions via Google Maps.
- Full-screen map, wall detail screens, photo timelines, artwork filters, bookmarks, and full-screen photograph viewing.
- Camera/gallery contribution flow; date suggestions from available EXIF; manual location confirmation and nearby wall suggestions.
- Exact, year-only, approximate, and unknown dates. The photo date and upload time remain separate. Future and impossible dates are rejected.
- Multiple artworks and photographs at one wall. Later photographs can document the same artwork, a replacement, or a covered/removed piece.
- Community corrections to wall details, artwork attribution, photo dates, captions, and photographer credits. Edit history and restoration create new revisions; original image files cannot be overwritten through the app.
- Email-code sign-in for the live archive, public reads, authenticated writes, optimistic edit conflict handling, and realtime invalidation.
- Reports and a moderator queue. Backend moderator RPCs can hide tags and merge duplicate walls while preserving their photographs.
- Supabase migrations with row-level security, atomic contribution transactions, separate private originals/public previews, and upload policies.
- Local photo persistence: document files on Android, IndexedDB on web. Bookmarks and metadata use AsyncStorage.

## What is not live yet

No Google Cloud, Supabase, EAS, or Play Console project has been connected or deployed. A locally signed personal APK has been produced using the separate Capacitor shell. Camera capture, gallery selection, GPS permission, backup export/import, and local storage have been tested in an Android emulator. Physical-phone verification is still pending. Native Google Maps and live cloud auth/storage in the future Expo community version still need account credentials and device testing.

The browser preview has a real OpenStreetMap fallback. Supply a web Google Maps key to review Google Maps in the browser. The Android implementation uses the Google Maps SDK, not this web fallback.

This is a first implementation, not a copy of every Google Maps consumer feature. Embedded turn-by-turn navigation, Street View, offline map downloads, batch photo imports, push notifications, and a public website/universal links are not implemented. Sharing currently uses the app's `graffititag://tag/...` links, which require the installed app.

## Verification

```sh
cd mobile
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run check:android
npx expo-doctor
```

The Android check exports an unminified JavaScript bundle without Hermes bytecode; it checks native module resolution, not APK signing or device behavior. EAS release builds keep production optimization enabled.

The database tests execute the real migrations in PGlite/PostgreSQL with mock Supabase auth/storage schemas and real row-level policies and roles. They cover authenticated/public permissions, direct mutation denial, invalid dates, cross-wall references, upload ownership, edit conflicts, history, attribution/date corrections, moderation, and photo-preserving merges. They do not emulate Supabase's HTTP upload/auth services.

Browser tests exercise filtering, wall history, bookmarks, edits/restoration, a historical photo upload, persistent reloads, reports, moderator resolution, location search, and responsive layout. Playwright screenshots are written to `mobile/artifacts/`.

## Before a public beta

- Connect the accounts and complete two-user tests against the actual Supabase project.
- Test camera/gallery, denied permissions, Google map keys, back navigation, network loss, and upload retry on a physical Android phone.
- Publish the project’s contribution terms, privacy policy, deletion/contact process, and photo license policy. Current consent grants storage/display with credit; it does not grant public reuse of contributed photos.
- Configure database **and storage object** backups, retention, and restoration drills. Supabase database backups alone do not contain photo bytes.
- Add monitoring, cost controls, orphan-upload cleanup, and moderator coverage. Hidden database records disappear from browsing, but already-public preview URLs/caches need separate removal when a photo must be taken down.
- Browsing currently returns at most 250 walls per viewport/search. Before large-scale launch, add server aggregation at low zoom, pagination, and spatial indexing for larger datasets.
- Review upstream dependency advisories. The generated Expo SDK 58 toolchain currently reports inherited `braces`, `node-forge`, and `uuid` advisories; the safe npm updates were applied. Do not use `npm audit fix --force`, which proposes downgrading Expo to an incompatible SDK.

## Credits

Demo photos by Gveret Tered, Wikimedia Commons, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Sources and display treatment are recorded in [ATTRIBUTION.md](../mobile/assets/demo/ATTRIBUTION.md) and in the app. The application source and user-contributed photographs have separate licensing concerns.

### Place search

The personal Android shell and Leaflet web map use Photon for submitted city/address searches;
Google Maps builds retain Google's geocoder. `EXPO_PUBLIC_PHOTON_URL` can select a different
Photon-compatible endpoint at build time. The default is `https://photon.komoot.io/api/`.
Only explicit submissions send requests; identical pending requests are shared and up to
100 successful lookups are cached for the session. Requests time out after 30 seconds; the public server has been observed responding successfully after 14–17 seconds.
The map displays attribution to OpenStreetMap contributors. Up to five named results include address context; towns use their returned bounds and addresses/landmarks get a closer view and a separate search pin. Decimal latitude, longitude pairs work offline. Android requests use Capacitor HTTP with an identifying User-Agent and bounded connect/read timeouts. No location permission is needed for search. Street-number-town input such as `Ilica 10 Zagreb` uses Photon’s `/structured` endpoint with separate street, house-number, and city parameters. Free-form requests returned an unrelated street segment rather than number 10, even with a comma.

The [Photon public server](https://github.com/komoot/photon#demo-server) allows reasonable
project traffic, with no availability guarantee. Use a dedicated instance before scaling
beyond personal use. Place search requires internet; archive filtering remains local in
personal mode. Search errors persist independently of archive/map refreshes.

Regression checks: `npm test` and, against a personal build preview,
`npx playwright test --config playwright.personal.config.ts search.spec.ts`.

### Android update checks

Personal Android 1.0.4 adds automatic startup checks and My archive > App updates. The native bridge reads the installed version through Capacitor App.getInfo; the shared service compares numeric versions and accepts only stable personal release tags with an APK asset from this repository. A failed check does not block the local archive. The browser opens the GitHub APK download and Android asks the user to install it. Publishing a newer compatible APK as the latest GitHub release makes it discoverable from installed apps.

### Multiple artwork categories (1.0.9)

New contributions and photo/artwork corrections allow one or more categories.
`kinds` stores the full selection and `kind` mirrors its first item for compatibility
with older local archives and backups. Missing `kinds` is read as `[kind]`.
Search matches any category of the photographed artwork, together with the photo year.
Backup validation checks the full category list, including revision snapshots.
Community deployments must apply `004_artwork_categories.sql` before using this client;
the personal Android app stores its categories locally and needs no server migration.
