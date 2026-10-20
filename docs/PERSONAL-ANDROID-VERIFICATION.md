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

## 19 October 2026: selection appearance update

Personal Android 1.0.1, version code 2. SHA-256: `7f28cb273006f848435547cf5419cb102dc8961f1322ad323ac02724def57cc2`.

Removed browser focus rings from clicked buttons, checkboxes and map markers, and removed chip borders. Selected options keep their dark fill. Keyboard focus uses a brightness change. Browser checks confirmed border-free selected chips, outline-free checked controls, working location confirmation, and visible keyboard focus. Expo lint, TypeScript, the APK build and signature verification pass. Native behavior was not retested in an emulator for this appearance-only update.

## 19 October 2026: loading screen update

Personal Android 1.0.2, version code 3. SHA-256: `f621631371d3b0baffdc6afb2d607c4231296fa57e0a75839be0568c479b93ef`.

Added the approved dark concrete/sticker design with a street-map overlay, the actual bundled Space Grotesk Bold title, and an animated indeterminate loading bar. Foreground artwork scales to fit short screens, landscape and tablets; the background alone crops. The personal export includes this design in the initial HTML response, before JavaScript, and precaches its artwork and font for offline startup. Reduced-motion preferences disable the loading animation. The Android system splash uses a separate pin with proportional transparent padding inside its icon mask.

Validation: Expo lint, TypeScript, all 24 unit/database tests, both personal browser tests (archive/backup/offline editing and pre-JavaScript loading), APK build and signature verification. The loading test checks 320×568, 412×915, 915×412 and 800×1280 layouts, loaded artwork, reduced motion and transition into the app. Installed over 1.0.1 on the API 36 emulator without clearing data; saved archive/bookmark storage remained unchanged and the existing wall was visible. Physical-phone verification remains pending.

## 19 October 2026: home-screen icon fix

Personal Android 1.0.3, version code 4. SHA-256: `d952c34b5ba65cb58b853a1d1adcfd4f9252151d19453742545c9b4780f981c8`.

The personal build previously copied the oversized, opaque legacy icon into the adaptive foreground, so circular launcher masks clipped the pin. The build now uses the existing transparent, padded `android-icon-foreground.png` for adaptive foreground resources at every density. Legacy icons retain their existing source. The full-screen loading design is unchanged.

Verified script syntax, APK build/signature and installation over 1.0.2 in the API 36 emulator. Inspected the installed launcher icon and a circular-mask preview. All foreground pixels with alpha greater than 8 lie within normalized radius 0.2819, inside Android's guaranteed circular safe radius of 33/108 (0.3056); the tip and paint drips remain visible.

## 19 October 2026: in-app updates, location, and search

Personal Android 1.0.4, version code 5. SHA-256: `109f076e3aa6dfc034faff2b816f6a8bc9b1059499bb59df2f6bca3fb829a9d3`.

Added startup release checks, a map update banner, and My archive > App updates with installed version, manual retry, release notes and APK download. The download opens externally and Android confirms installation. The app accepts stable personal tags and the repository's expected APK asset; offline checks do not block the archive. This release also includes foreground GPS position/accuracy, permission handling, Photon place lookup, and responsive map controls.

Validation: TypeScript, Expo lint, all 29 unit/database tests, 9 demo browser tests and 7 personal browser tests. Update tests cover numeric version comparison, release/asset validation, automatic detection, native installed version, download URL, offline errors, retry, and current-version status. Built and verified the APK signature. Installed the final 1.0.4 APK over the emulator's existing installation without clearing data; archive and bookmark local-storage values were unchanged, and the native version bridge and update controls were present. Physical-phone verification remains pending.

## 20 October 2026: town, landmark, and numbered-address search

Personal Android 1.0.5, version code 6. SHA-256: `2c740eb340efa5042c1f5842d34ff1974ef272a7ff3cc6ae18db47dd45985332`.

Reproduced valid Photon queries taking 14–17 seconds against the previous 12-second timeout. Raised the deadline to 30 seconds, added native Android HTTP transport, five named choices with address context, result pins, area-based town framing, closer address/landmark views, and offline decimal coordinate input. Search does not request GPS permission. Street-number-town input uses the structured endpoint; free-form `Ilica 10 Zagreb` returned another Ilica road segment. Structured lookup resolves the number 10 building and refuses to silently substitute a street segment when a requested number is absent. Map tools move below the result panel so they do not cover Clear location result.

Verified the isolated search release with TypeScript, Expo lint, 35 unit/database tests, 9 demo browser tests, and 10 personal browser tests. Native live checks found Osijek and Ban Jelačić Square. The final APK resolved `Ilica 10 Zagreb` to `Ilica 10`; Add tag used latitude 45.8133875 and longitude 15.97439535, at the building rather than the unrelated western road segment. APK build and signing verification passed with the existing certificate. Emulator upgrades preserved archive and bookmark storage. Physical-phone verification remains pending.

The first emulator run had stale DNS after an overnight network change; a restart restored resolution. An earlier WebView process crashed during concurrent debugging connections; final live verification used a single connection. Search release source and APK were prepared in an isolated worktree to exclude unrelated map-placement/filter edits in progress.
