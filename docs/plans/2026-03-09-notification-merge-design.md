# Notification Merge Design

**Problem:** ColdGuard currently writes locally derived notification incidents into the same SQLite cache used for backend-backed incidents. That mixes synthetic data with persisted server data, makes sync failures look like valid inbox results, and increases the risk of application errors when local-only IDs flow through code paths meant for Convex records.

**Decision:** Keep backend-backed notifications in the persisted cache and treat locally derived device incidents as runtime overlays. Load both sources, merge them in memory, and deduplicate by the stable local incident identity already defined by the notification policy (`deviceId:incidentType`). When both sources describe the same incident, the backend-backed record wins because it carries authoritative status and timeline data.

**Data Flow:**
- Remote inbox sync persists only backend-backed incidents into SQLite.
- Local device data is converted into derived incidents at read time and is never written into the notification cache.
- The provider requests a merged inbox result that includes:
  remote cached incidents,
  local derived incidents,
  a sync error when the remote refresh fails.
- Local derived incidents fill gaps when the backend has not yet persisted an incident.

**Error Handling:**
- Remote sync failures should no longer silently replace the inbox with seeded local records.
- The app should still render merged notifications using the last known remote cache plus local derived incidents.
- The provider should surface a notification sync error message when the remote refresh fails instead of masking it.

**Naming Fix:**
- Expo config and Android generated resources still use `ColdGuard_app_tmp`.
- Update the Expo app name/slug/package and Android string/project names so permission UI and launcher labels show `ColdGuard`.
