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

The app starts with an empty private archive. It requires Android 7 or newer and a current Android System WebView. No Expo, Google Cloud, Supabase, or Play account is needed to use the installed APK. Photo records stay in the app's local storage and image blobs in its WebView IndexedDB. Android cloud backup and device-transfer backup are disabled for this package.

Use My archive > Export backup after adding photos. Save the JSON file with Android's Save file dialog, then keep another copy on a computer or storage provider you choose. Import backup adds missing tags and leaves existing tags untouched, including newer edits. This first JSON backup format has a 50 MB per-file limit; it is not an unlimited archive backup system. Exports are prepared in bounded chunks in app cache before opening the document picker, avoiding Android saved-state parcel limits. Uninstalling or clearing app data removes the archive. Install later compatible APKs as updates, using the same package and signing key.

The APK bundles its interface and works independently of the development computer. Saved photographs, records and editing work offline. OpenStreetMap tiles and place lookup need internet. This package does not include Google Maps navigation or a public community archive. The Expo/Supabase community implementation remains separate under `mobile` and `supabase`.
