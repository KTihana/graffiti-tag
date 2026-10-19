# Personal Android verification, 18 October 2026

APK: `personal-android/artifacts/graffiti-tag-personal-debug.apk`
Package: `app.graffititag.personal`, version 1.0 (code 1), minimum Android API 24.
SHA-256: `38045997417d82f38e03961afe354ea56bf56d61dfb4411b833d099b42d0e65b`

The release includes the later logo and marker artwork update. The application bundle matches the tested build after asset hash normalization; APK signing was verified again before GitHub publication.

## Passed

- Gradle debug APK build and Android apksigner verification.
- Install and update in CommonTest36 Android emulator (API 36).
- Empty personal archive, no sample tags, no Supabase connection.
- Native camera permission, capture, image display and saving to a wall.
- Native gallery photo picker and display of the selected photograph.
- Native precise location permission and coordinates from emulator GPS.
- Save a photograph and tag, reload, update APK and retain records.
- Export the archive through Android's Save file dialog into Downloads.
- Import that backup into an emulator installation with cleared app data. Original photo bytes, date and wall coordinates survived. This clearing was restricted to emulator QA data.
- Save a 50 MB test file through the chunked native backup path without crashing.
- Disable emulator Wi-Fi and mobile data, reopen the installed app and load restored photo and wall history offline.
- Kill the app process while the external camera is open, capture a photo and return. The app recovers the contribution route and photograph. The bridge uses Capacitor's legacy getPhoto flow because the newer takePhoto flow in pinned version 8.2.6 did not restore this result in the test.
- TypeScript and Expo lint checks.
- 24 domain, backup-format and SQL tests during implementation.
- Four existing browser end-to-end tests.
- Personal browser end-to-end test: capture entry, GPS, contribution, bookmark, exact original-byte backup, recovery in a fresh context, offline editing and preserving newer edits on import.
- Private download page mobile layout and APK delivery checked. Hosted APK hash matches the local build.

## Limits

A physical Android phone has not been tested. Android device-specific camera behavior and older WebView versions may differ. The first backup format has a 50 MB per-file limit. There is no automatic cloud sync. Uninstalling or clearing app data removes the local archive. Basemap tiles and place search need internet; no offline map download feature is included. Future community Google Maps/Supabase workflows are separate and have not been deployed.
