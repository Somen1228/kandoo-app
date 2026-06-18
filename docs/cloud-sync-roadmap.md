# Optional Cloud Sync Roadmap

Cloud support must remain optional. A user without a subscription should retain the complete local app and own a usable SQLite workspace.

## Boundary

The current local repository is the source of truth:

```text
CardsContext -> local repository -> SQLite
                            |
                            +-> optional sync coordinator
                                  -> entitlement check
                                  -> cloud API
```

The sync coordinator should observe successful local saves. UI components should not call the cloud API directly.

## Required Before Sync

1. Add stable `updatedAt` metadata and a device identifier to boards or workspace revisions.
2. Define conflict behavior for edits made on two offline devices.
3. Add a durable outbound change queue and retry policy.
4. Add account authentication only inside the cloud feature.
5. Validate subscription entitlements server-side.
6. Encrypt transport and protect stored cloud data.
7. Provide download, account deletion, and subscription-expiry behavior.

## Delivery Order

1. Paid cloud backup with manual restore.
2. Automatic one-way backup after local saves.
3. Multi-device sync with explicit conflict handling.
4. App Store subscription integration or direct-download licensing, depending on the chosen distribution channel.

Do not begin with real-time collaboration. Backup and deterministic two-device sync are smaller, testable products and establish the storage contract first.
