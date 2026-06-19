# Cloud Sync and Platform Roadmap

Kandoo remains local-first. Authentication adds account-scoped cloud backup and
multi-device access; it does not make the API the only copy of a workspace.

## Shared architecture

```text
React UI
  -> AuthContext (Firebase identity)
  -> CardsContext
       -> local repository
       |    -> SQLite on Tauri macOS/Android
       |    -> localStorage on web
       |
       -> sync coordinator
            -> Express API
                 -> Firebase Admin token verification
                 -> PostgreSQL revisioned workspace
```

Every local save completes before cloud upload. A user can continue offline,
export their data, and use the full application without an account.

## Current migration slice

- Email/password authentication on web and Tauri.
- Google authentication on the web and desktop. Desktop uses the system
  browser with PKCE and a loopback callback before creating a Firebase
  credential.
- Account-scoped browser and SQLite workspace keys.
- Automatic adoption of an offline workspace when a new cloud account is empty.
- Migration of legacy web-server `boards` rows into the revisioned workspace.
- Optimistic revision checks and explicit conflict choices.
- Netlify frontend and standalone Node/PostgreSQL backend configuration.

## Android delivery plan

1. Install Android Studio, JDK 17+, SDK Platform Tools, NDK, and Build Tools.
2. Run `npm run android:init` once the toolchain variables are configured.
3. Add a mobile shell: bottom navigation, collapsible project/page drawers, and
   touch-sized task/card controls while keeping the same React feature modules.
4. Verify SQLite migrations and offline recovery on Android.
5. Add Android Google authentication through Credential Manager. The desktop
   loopback flow is intentionally not reused on mobile.
6. Test background/resume sync, poor connectivity, conflict handling, imports,
   images, and Android back navigation.
7. Configure signing, Play Console application ID, privacy policy, and staged
   internal testing before production.

## Web delivery plan

1. Configure Firebase web credentials and authorize the production domain.
2. Deploy the API with PostgreSQL and Firebase Admin secrets.
3. Set `VITE_API_URL` and Firebase variables in Netlify before building.
4. Deploy a preview, verify login and sync, then promote it to the existing
   Kandoo domain.

## Later sync hardening

- Move base64 image payloads to object storage with signed URLs.
- Add a durable outbound queue rather than only an in-memory retry.
- Add workspace history and server-side backups.
- Add account export and deletion endpoints.
- Add automated two-device conflict and migration tests.
