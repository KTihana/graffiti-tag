# Graffiti Tag Personal for Android

This separate Capacitor shell packages the Expo web export as a native Android app. It does not use or modify `mobile/android`.

## Build a personal debug APK

Requirements: Node.js 22 or later, JDK 21, and Android SDK platforms/build tools available locally. The default build script uses the Homebrew OpenJDK 21 and `$HOME/Library/Android/sdk` paths on macOS when the corresponding environment variables are unset.

From this directory:

```sh
npm ci
npm run build:apk
```

The script rebuilds `../mobile/dist-personal` in personal archive mode, copies that export into the app, removes the web service-worker registration, bundles the native bridge, synchronizes Capacitor plugins, and runs `assembleDebug`. It writes the installable APK to `artifacts/graffiti-tag-personal-debug.apk`.

The debug APK is signed with Android's local debug key and is intended for personal installation. Keep the local debug keystore intact to preserve upgrade behavior across rebuilds. Install or update on a connected Android device with:

```sh
adb install -r artifacts/graffiti-tag-personal-debug.apk
```

## Native bridge

`src/native-bridge.ts` exposes `window.GraffitiNative` with camera/gallery photo selection, foreground location, JSON backup saving, restored camera results, and Android Back handling. Camera images use Capacitor's WebView-served `webPath` so the web app can read their bytes. Captured camera photos use JPEG quality 100 to avoid an extra lossy reduction, but the native camera does not provide a sensor RAW or untouched-original file; gallery selection keeps the selected source image format when available. Android's document picker saves backups directly to the user-selected location without requiring a cloud sharing account. The native app does not register the PWA service worker. The archive, bundled fonts and demo images work offline after installation; map tiles need an internet connection.

## Personal installation and backups

Location access is optional. Tap the locate button on the map to request it and center on your current position. A blue dot follows your foreground GPS updates, and a blue circle shows the reported accuracy. Tap the button again to recenter after panning. The same dot appears when placing a wall, while the wall pin stays where you set it. Location updates pause when the app is in the background; browsing and manual placement work without permission.

The app starts with an empty private archive. It requires Android 7 or newer and a current Android System WebView. No Expo, Google Cloud, Supabase, or Play account is needed to use the installed APK. Photo records stay in the app's local storage and image blobs in its WebView IndexedDB. Android cloud backup and device-transfer backup are disabled for this package.

Use My archive > Export backup after adding photos. Save the JSON file with Android's Save file dialog, then keep another copy on a computer or storage provider you choose. Import backup adds missing tags and leaves existing tags untouched, including newer edits. This first JSON backup format has a 50 MB per-file limit; it is not an unlimited archive backup system. Exports are prepared in bounded chunks in app cache before opening the document picker, avoiding Android saved-state parcel limits. Uninstalling or clearing app data removes the archive. Install later compatible APKs as updates, using the same package and signing key.

The APK bundles its interface and works independently of the development computer. Saved photographs, records and editing work offline. OpenStreetMap tiles and place lookup need internet. This package does not include Google Maps navigation or a public community archive. The Expo/Supabase community implementation remains separate under `mobile` and `supabase`.

## In-app updates

Starting with 1.0.4, the app checks the public GitHub latest-release API on launch and shows a map banner when a newer compatible personal release is available. My archive > App updates also provides a manual check, installed version, release notes, and download button. Downloads open the system browser; Android handles APK installation with user confirmation. No background push service or GitHub sign-in is required. Offline and failed checks leave the archive usable and can be retried.

Install the new APK over the old app without uninstalling. Updates must keep application ID `app.graffititag.personal`, the same signing key, and a higher Android `versionCode`. Future releases must use a stable tag like `v1.0.5-personal`, attach `graffiti-tag-personal.apk`, and be published as the latest GitHub release. Keep `mobile/src/services/appUpdates.ts` and this package version aligned with the Android version. Never commit the signing key.

## Search towns and places

Enter a town, street address, landmark, or decimal coordinates (for example `45.555, 18.695`) and tap the search button or your keyboard’s Search key. The first match appears on the map; choose another named result when offered. Towns fit their area, while addresses and landmarks zoom in. A green pin and place label keep the search location visible even when no archive records exist there. Tap Done to close the choices or Clear location result to remove the search pin.

Search does not need GPS permission. Named places require internet; coordinate searches work offline. Photon’s public service can be slow, so requests wait up to 30 seconds and can be retried. Successful searches are cached for the session. Android uses its native HTTP transport.
