import { REQUEST_HEADER } from "../protocol";
import { errorResponse } from "./json-response";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "[::1]"]);
const LOOPBACK_IPV4 = /^127(?:\.\d{1,3}){3}$/;
const IPV4_MAPPED_PREFIX = "::ffff:";
const TRUSTED_FETCH_SITES = new Set(["same-origin", "none"]);

function hostnameOf(request: Request): string | null {
  const host = request.headers.get("host") ?? new URL(request.url).host;
  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isLoopbackHostname(hostname: string): boolean {
  return (
    LOOPBACK_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    LOOPBACK_IPV4.test(hostname)
  );
}

export function isLoopbackAddress(address: string | undefined): boolean {
  if (address === undefined) {
    return false;
  }
  const ipv4 = address.startsWith(IPV4_MAPPED_PREFIX)
    ? address.slice(IPV4_MAPPED_PREFIX.length)
    : address;
  return address === "::1" || LOOPBACK_IPV4.test(ipv4);
}

// Host check blocks DNS rebinding: a rebound domain is same-origin with itself.
export function rejectUntrustedHost(
  request: Request,
  allowedHosts: string[]
): Response | null {
  const hostname = hostnameOf(request);
  const isAllowedHost =
    hostname !== null &&
    (isLoopbackHostname(hostname) || allowedHosts.includes(hostname));
  if (!isAllowedHost) {
    return errorResponse(
      "Retouche only answers on localhost. Add other dev hostnames to allowedHosts or RETOUCHE_HOSTS.",
      403
    );
  }
  return null;
}

export function rejectUntrustedCaller(
  request: Request,
  allowedHosts: string[]
): Response | null {
  if (request.headers.get(REQUEST_HEADER) !== "1") {
    return errorResponse(
      `Retouche requests must send the ${REQUEST_HEADER} header.`,
      403
    );
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  const hostname = hostnameOf(request);
  // Browsers omit Sec-Fetch-Site only on insecure origins, never loopback.
  const mayOmitFetchSite =
    hostname !== null &&
    allowedHosts.includes(hostname) &&
    !isLoopbackHostname(hostname);
  const isTrustedSite =
    fetchSite === null ? mayOmitFetchSite : TRUSTED_FETCH_SITES.has(fetchSite);
  if (!isTrustedSite) {
    return errorResponse(
      "Retouche only answers requests from the app's own origin.",
      403
    );
  }

  return null;
}
