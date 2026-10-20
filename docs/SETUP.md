# Connect Graffiti Tag

## 1. Shared archive: Supabase

Create a Supabase project in an appropriate region. In its SQL editor, run the migration files in order:

1. `supabase/migrations/001_archive.sql`
2. `supabase/migrations/002_record_corrections.sql`
3. `supabase/migrations/003_likes_collections.sql`

They create tags, artworks, photos, profiles, revisions, reports, moderator roles, likes, private saved pieces and collections, storage buckets, policies, and narrowly scoped RPCs. Apply each migration once. Existing projects with migrations 001 and 002 need only migration 003.

Likes belong to individual artworks across their photographs. Community members must sign in to like, save, and organize pieces; aggregate like counts are public. Collections are private. A piece can belong to several collections. Removing it from a collection or deleting a collection keeps the piece saved; unsaving removes it from every collection. Counts refresh every 30 seconds while the app is open. Personal/demo mode stores these features on the device, with no shared count. Personal backups include likes and collections; older backups without these fields remain supported.

Copy `mobile/.env.example` to `mobile/.env`. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` using the project's URL and **publishable key**, never its service-role key.

Enable email authentication. In Authentication → Email Templates → Magic Link, include `{{ .Token }}` so the email contains the sign-in code accepted by the app. Configure a real SMTP service before inviting general users; default test email delivery is restricted. No deep-link callback is needed for the code flow.

After your own first sign-in, promote your account using the SQL editor:

```sql
insert into public.moderators(user_id) values ('YOUR_AUTH_USER_UUID');
```

The app never allows users to grant themselves this role. The account page exposes the moderation queue only to moderators (or in the local demo).

The moderation UI resolves reports. Administrative hiding/merging are currently backend operations, executed with an authenticated moderator's JWT through the matching RPC. Both retain records and an audit trail. Do not put an admin/service-role key in the app.

## 2. Android Google Maps

Create a Google Cloud project with billing configured and enable **Maps SDK for Android**. Create an Android-restricted key for:

- Application ID: `app.graffititag.archive`
- SHA-1: the signing certificate of the development/preview build, or the Play App Signing certificate for the store build.

Set `GOOGLE_MAPS_ANDROID_API_KEY` in the build environment. Native map keys are compiled into the app and require rebuilding after changes. Keep the package name and signing restrictions in sync.

The optional browser review needs a **different**, HTTP-referrer-restricted key with Maps JavaScript API enabled. Put that in `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY`. The browser's full place search also requires geocoding access. Without this key the preview uses OpenStreetMap and a small list of demo cities for city search. Android address search uses the platform geocoder.

## 3. Build an installable Android APK

From `mobile`:

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

Set the map key and public Supabase configuration in EAS's preview environment before building. The `.env` file is intentionally not committed. Review the EAS project association and signing credentials while configuring your account.

The `preview` profile builds an APK for direct installation; `production` builds an Android App Bundle for Google Play. The repository's `eas.json` provides both profiles. EAS supplies the native build toolchain, so local Android Studio is not necessary for a cloud build.

An APK that has not been configured with a map key displays a connection message instead of attempting to initialize an unconfigured native Google map. Expo Go can use its bundled map configuration for development.

## 4. Verify on two devices

1. Browse while signed out.
2. Sign in with account A and upload a photo from an older year.
3. Find the same wall while signed out and on account B.
4. Add a new layer, correct attribution, and restore a prior version.
5. Try simultaneously editing the same revision; the stale save should be rejected.
6. Verify original storage files cannot be overwritten/deleted by normal app users.
7. File a report and resolve it using a moderator account.
8. Confirm Android photo/location permission denial leaves manual alternatives available.

## Archive operations

Private `originals` holds the file returned by the picker. Public `previews` holds a JPEG derivative. Database transactions are atomic, but object uploads and database commits are separate requests. A failed upload/commit can leave an unreferenced object; schedule a conservative cleanup job that deletes only unreferenced objects older than a grace period. Do not delete uploaded files automatically after an ambiguous network error: the database transaction may already have committed.

Arrange backups for both SQL data and the storage objects. Verify a restore into a separate project before relying on the system as an archive. Configure realtime replication and periodically check the `tags` publication, storage quotas, and error logs.

## Documentation

- https://docs.expo.dev/versions/v58.0.0/sdk/map-view/
- https://docs.expo.dev/build/introduction/
- https://supabase.com/docs/guides/auth/quickstarts/react-native
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://developers.google.com/maps/documentation/android-sdk/get-api-key
