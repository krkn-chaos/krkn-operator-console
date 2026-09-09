/**
 * Request body size helpers.
 *
 * The krkn-operator API enforces a 10MB limit on request bodies for
 * mutating requests (POST/PUT/PATCH) and returns HTTP 413
 * (request_entity_too_large) when the limit is exceeded.
 *
 * Several console flows base64-encode user-provided content (kubeconfigs,
 * CA bundles, file contents) into JSON bodies. Base64 inflates the payload
 * by ~33%, so a modestly sized upload can silently cross the limit. These
 * helpers let forms validate the *actual serialized body* client-side and
 * surface a friendly message before the request is sent, and keep the limit
 * defined in a single place shared with the central API client.
 */

/**
 * Maximum request body size accepted by the krkn-operator API, in bytes (10MB).
 *
 * Keep this in sync with the server-side limit (introduced in krkn-operator
 * PR #73). Uses binary megabytes (10 * 1024 * 1024) to match the server.
 */
export const MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024;

/**
 * Human-readable form of the limit, used in validation and error messages.
 */
export const MAX_REQUEST_BODY_LABEL = '10MB';

/**
 * Compute the byte size of a value once serialized as a JSON request body.
 *
 * Uses the UTF-8 encoded length so multi-byte characters are counted exactly
 * as the server will receive them, matching what {@link authenticatedFetch}
 * sends over the wire.
 *
 * @param payload - The value that will be passed to `JSON.stringify` as the body.
 * @returns The size of the serialized body in bytes.
 */
export function getJsonBodySize(payload: unknown): number {
  return new Blob([JSON.stringify(payload)]).size;
}

/**
 * Determine whether a serialized payload would exceed the API body limit.
 *
 * @param payload - The value that will be sent as a JSON request body.
 * @returns `true` if the serialized body exceeds {@link MAX_REQUEST_BODY_BYTES}.
 */
export function exceedsRequestBodyLimit(payload: unknown): boolean {
  return getJsonBodySize(payload) > MAX_REQUEST_BODY_BYTES;
}
