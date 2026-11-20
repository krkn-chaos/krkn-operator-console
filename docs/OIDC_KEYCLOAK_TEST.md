# Keycloak OIDC console test

Use a krkn-operator backend containing the identity provider API and serve the console through the same HTTPS origin as `/api/v1`. The `krkn_session` cookie is `Secure`, so HTTPS is the reliable setup for browser testing. In local development, the Vite proxy forwards `/api` to `localhost:8080`.

1. Log in with a local admin account and open **Settings → Users & Groups → Identity management**.
2. Add a Keycloak provider. The provider ID is permanent and scopes user identities, blocks, and group mappings. Enter the exact realm issuer URL, the confidential login client ID and secret, and the callback URL ending in `/api/v1/auth/oidc/{provider-id}/callback`. Register that exact callback in Keycloak's valid redirect URIs.
3. To browse groups, provide a separate Keycloak service client ID and secret with realm group read access. Configure the login client to include full group paths such as `/Engineering/Ops` in the ID token's `groups` claim.
4. Enable the provider. Log out and check that **Log in with {display name}** appears. Sign in through Keycloak. The console restores the operator cookie session via `/api/v1/auth/session` and sends its CSRF token on writes. WebSockets use the same browser cookie.
5. As admin, choose the provider and a local group, search the remote directory, and map the full remote path. Several remote groups can map to one local group. A new OIDC user with no mapped groups sees the access empty state until an admin adds a mapping and the user refreshes access.
6. After a successful OIDC login, the account appears under **OIDC users**. Disable it to deny access immediately, delete it to permit reprovisioning on the next login, or **Delete & blacklist** to prevent future logins for that provider, issuer, and subject. The blacklist view allows unblocking.

The provider secret is entered only when creating or rotating credentials; the backend returns presence flags and never returns the secret values. Environment-configured providers are shown as read-only in the admin UI.
