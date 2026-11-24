// Flow Session Share - Cookie Parsing & Injection Engine

export interface ParsedCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'unspecified' | 'no_restriction' | 'lax' | 'strict';
  expirationDate?: number;
  hostOnly?: boolean;
  storeId?: string;
}

export interface InjectionResult {
  total: number;
  successful: number;
  failed: number;
  details: Array<{
    name: string;
    domain?: string;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Parses raw cookie input into an array of normalized cookie definitions.
 * Handles:
 * 1. JSON array of cookies (from Cookie-Editor, DevTools, or EditThisCookie)
 * 2. Single JSON cookie object
 * 3. Cookie header string ("SID=xxx; HSID=yyy; ...")
 * 4. Netscape/curl cookie format
 * 5. Single raw token value (mapped to defaultCookieName)
 */
export function parseRawCookies(
  rawInput: any,
  targetUrl: string,
  defaultCookieName = 'flow_session',
  defaultDomain = 'flow.google.com',
  expiresAt?: string | number
): ParsedCookie[] {
  if (!rawInput) return [];

  // 1. If already an array
  if (Array.isArray(rawInput)) {
    return normalizeCookieList(rawInput, targetUrl, defaultDomain, expiresAt);
  }

  // 2. If it's an object with name and value
  if (typeof rawInput === 'object' && rawInput !== null && rawInput.name && rawInput.value !== undefined) {
    return normalizeCookieList([rawInput], targetUrl, defaultDomain, expiresAt);
  }

  const trimmed = String(rawInput).trim();
  if (!trimmed) return [];

  // 3. Try parsing as JSON
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeCookieList(parsed, targetUrl, defaultDomain, expiresAt);
      } else if (typeof parsed === 'object' && parsed !== null) {
        if (parsed.name && parsed.value !== undefined) {
          return normalizeCookieList([parsed], targetUrl, defaultDomain, expiresAt);
        }
        // Key-value object: { "SID": "...", "HSID": "..." }
        const entries = Object.entries(parsed).map(([k, v]) => ({
          name: k,
          value: String(v),
        }));
        return normalizeCookieList(entries, targetUrl, defaultDomain, expiresAt);
      }
    } catch {
      // Not valid JSON, proceed to other formats
    }
  }

  // 4. Try parsing Netscape HTTP Cookie File format (tab-separated lines)
  if (trimmed.includes('\t') && (trimmed.includes('#') || trimmed.includes('.google') || trimmed.includes('flow'))) {
    const lines = trimmed.split(/\r?\n/);
    const parsedFromNetscape: ParsedCookie[] = [];
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine || cleanLine.startsWith('#')) continue;
      const parts = cleanLine.split('\t');
      if (parts.length >= 7) {
        // [domain, flag, path, secure, expiration, name, value]
        parsedFromNetscape.push({
          domain: parts[0],
          path: parts[2] || '/',
          secure: parts[3]?.toUpperCase() === 'TRUE',
          expirationDate: Number(parts[4]) || undefined,
          name: parts[5],
          value: parts[6] || '',
        });
      }
    }
    if (parsedFromNetscape.length > 0) {
      return normalizeCookieList(parsedFromNetscape, targetUrl, defaultDomain, expiresAt);
    }
  }

  // 5. Try parsing semicolon-separated or newline-separated cookie string ("name1=val1; name2=val2")
  if (trimmed.includes('=')) {
    const parts = trimmed.split(/[;\r\n]+/);
    const parsedPairs: Array<{ name: string; value: string }> = [];

    for (const part of parts) {
      const p = part.trim();
      if (!p || p.startsWith('#')) continue;
      const eqIdx = p.indexOf('=');
      if (eqIdx > 0) {
        const name = p.substring(0, eqIdx).trim();
        const value = p.substring(eqIdx + 1).trim();
        if (name) {
          parsedPairs.push({ name, value });
        }
      }
    }

    if (parsedPairs.length > 0) {
      return normalizeCookieList(parsedPairs, targetUrl, defaultDomain, expiresAt);
    }
  }

  // 6. Fallback: single raw token value (e.g. JWT or session ID)
  return normalizeCookieList(
    [
      {
        name: defaultCookieName || 'flow_session',
        value: trimmed,
      },
      {
        name: 'flow_delegated_session',
        value: trimmed,
      },
    ],
    targetUrl,
    defaultDomain,
    expiresAt
  );
}

/**
 * Normalizes raw cookie records into valid ParsedCookie shapes.
 */
function normalizeCookieList(
  items: any[],
  targetUrl: string,
  defaultDomain: string,
  defaultExpiresAt?: string | number
): ParsedCookie[] {
  let fallbackDomain = defaultDomain;
  try {
    const u = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
    fallbackDomain = u.hostname;
  } catch {}

  const defaultExpSeconds = defaultExpiresAt
    ? typeof defaultExpiresAt === 'number'
      ? defaultExpiresAt > 10000000000
        ? Math.floor(defaultExpiresAt / 1000)
        : defaultExpiresAt
      : Math.floor(new Date(defaultExpiresAt).getTime() / 1000)
    : undefined;

  const result: ParsedCookie[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const name = String(item.name || item.key || '').trim();
    if (!name) continue;

    const value = String(item.value ?? item.val ?? '');

    // Normalize domain
    let domain = item.domain ? String(item.domain).trim() : undefined;
    if (!domain && fallbackDomain) {
      domain = fallbackDomain;
    }

    // Host-only flag
    const hostOnly = Boolean(
      item.hostOnly ??
      item.host_only ??
      (name.startsWith('__Host-') || (domain && !domain.startsWith('.')))
    );

    // Path
    let path = item.path ? String(item.path).trim() : '/';
    if (!path.startsWith('/')) path = '/' + path;

    // Secure
    let secure = Boolean(item.secure);
    if (name.startsWith('__Secure-') || name.startsWith('__Host-') || targetUrl.startsWith('https:')) {
      secure = true;
    }

    // HttpOnly
    const httpOnly = Boolean(item.httpOnly ?? item.http_only ?? false);

    // SameSite
    let sameSite: 'unspecified' | 'no_restriction' | 'lax' | 'strict' = 'unspecified';
    if (item.sameSite) {
      const ss = String(item.sameSite).toLowerCase();
      if (ss === 'none' || ss === 'no_restriction') {
        sameSite = 'no_restriction';
        secure = true; // Chrome requires secure=true when sameSite='no_restriction'
      } else if (ss === 'lax') {
        sameSite = 'lax';
      } else if (ss === 'strict') {
        sameSite = 'strict';
      }
    }

    // Expiration date (in seconds)
    let expirationDate: number | undefined;
    if (item.expirationDate !== undefined && item.expirationDate !== null && item.session !== true) {
      const exp = Number(item.expirationDate);
      if (!isNaN(exp) && exp > 0) {
        expirationDate = exp > 10000000000 ? Math.floor(exp / 1000) : Math.floor(exp);
      }
    } else if (defaultExpSeconds) {
      expirationDate = defaultExpSeconds;
    }

    result.push({
      name,
      value,
      domain,
      path,
      secure,
      httpOnly,
      sameSite,
      expirationDate,
      hostOnly,
      storeId: item.storeId ? String(item.storeId) : undefined,
    });
  }

  return result;
}

/**
 * Builds the exact SetDetails payload required by chrome.cookies.set.
 */
export function buildChromeCookieDetails(
  cookie: ParsedCookie,
  targetUrl: string
): chrome.cookies.SetDetails {
  let targetProto = 'https';
  let targetHostname = 'flow.google.com';

  try {
    const u = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
    targetProto = u.protocol.replace(':', '');
    targetHostname = u.hostname;
  } catch {}

  const domain = cookie.domain || targetHostname;
  const cleanHost = domain.replace(/^\./, '');

  const isHttps =
    cookie.secure ||
    targetProto === 'https' ||
    cleanHost.includes('google') ||
    cleanHost.includes('flow') ||
    cookie.name.startsWith('__Secure-') ||
    cookie.name.startsWith('__Host-') ||
    cookie.sameSite === 'no_restriction';

  const protocol = isHttps ? 'https' : 'http';
  const cookiePath = cookie.path || '/';
  const url = `${protocol}://${cleanHost}${cookiePath}`;

  const details: chrome.cookies.SetDetails = {
    url,
    name: cookie.name,
    value: cookie.value,
    path: cookiePath,
    secure: isHttps,
    httpOnly: cookie.httpOnly ?? false,
  };

  // Host-only cookies or __Host- prefixed cookies MUST NOT specify a domain property
  const isHostOnly = cookie.hostOnly || cookie.name.startsWith('__Host-');
  if (!isHostOnly && domain) {
    // If it's a domain-wide cookie (starts with . or meant for subdomains)
    details.domain = domain.startsWith('.') ? domain : `.${domain}`;
  }

  if (cookie.sameSite && cookie.sameSite !== 'unspecified') {
    details.sameSite = cookie.sameSite;
  }

  if (cookie.expirationDate && cookie.expirationDate > 0) {
    details.expirationDate = cookie.expirationDate;
  }

  if (cookie.storeId) {
    details.storeId = cookie.storeId;
  }

  return details;
}

/**
 * Safely sets a single cookie with fallback handling.
 */
export async function setCookieSafe(details: chrome.cookies.SetDetails): Promise<{ success: boolean; error?: string }> {
  if (typeof chrome === 'undefined' || typeof chrome.cookies === 'undefined') {
    return { success: false, error: 'chrome.cookies API unavailable' };
  }

  return new Promise((resolve) => {
    try {
      chrome.cookies.set(details, (cookie) => {
        const lastErr = chrome.runtime.lastError;
        if (lastErr) {
          // If setting with domain failed, try fallback as host-only cookie
          if (details.domain) {
            const fallbackDetails = { ...details };
            delete fallbackDetails.domain;
            chrome.cookies.set(fallbackDetails, (retryCookie) => {
              if (chrome.runtime.lastError || !retryCookie) {
                console.warn(`[Flow Cookies] Failed setting cookie ${details.name} (even host fallback):`, lastErr.message);
                resolve({ success: false, error: lastErr.message });
              } else {
                console.log(`[Flow Cookies] Set cookie ${details.name} as host-only fallback on ${fallbackDetails.url}`);
                resolve({ success: true });
              }
            });
            return;
          }

          console.warn(`[Flow Cookies] Failed setting cookie ${details.name} on ${details.url}:`, lastErr.message);
          resolve({ success: false, error: lastErr.message });
        } else if (!cookie) {
          console.warn(`[Flow Cookies] chrome.cookies.set returned null for ${details.name}`);
          resolve({ success: false, error: 'Returned null' });
        } else {
          console.log(`[Flow Cookies] Successfully set cookie: ${details.name} on ${details.url} (domain: ${cookie.domain})`);
          resolve({ success: true });
        }
      });
    } catch (err: any) {
      console.error(`[Flow Cookies] Exception while setting cookie ${details.name}:`, err);
      resolve({ success: false, error: err.message });
    }
  });
}

/**
 * Main entry point: Parses and injects all session cookies into the Chrome browser cookie jar.
 */
export async function injectAllSessionCookies(
  rawInput: any,
  targetUrl: string,
  defaultCookieName = 'flow_session',
  defaultDomain = 'flow.google.com',
  expiresAt?: string | number
): Promise<InjectionResult> {
  const parsedCookies = parseRawCookies(rawInput, targetUrl, defaultCookieName, defaultDomain, expiresAt);

  console.log(`[Flow Cookies] Parsing complete. Found ${parsedCookies.length} cookie(s) to inject for target: ${targetUrl}`);

  const results: InjectionResult['details'] = [];
  let successful = 0;
  let failed = 0;

  for (const cookie of parsedCookies) {
    const details = buildChromeCookieDetails(cookie, targetUrl);
    const res = await setCookieSafe(details);

    if (res.success) {
      successful++;
      results.push({ name: cookie.name, domain: details.domain || cookie.domain, success: true });
    } else {
      failed++;
      results.push({ name: cookie.name, domain: details.domain || cookie.domain, success: false, error: res.error });
    }

    // Special replicate rule for Google Flow:
    // If setting a cookie on flow.google.com, also replicate for flow.google
    if (details.url && details.url.includes('flow.google.com')) {
      const altUrl = details.url.replace('flow.google.com', 'flow.google');
      const altDetails: chrome.cookies.SetDetails = {
        ...details,
        url: altUrl,
      };
      if (altDetails.domain) {
        altDetails.domain = altDetails.domain.replace('flow.google.com', 'flow.google');
      }
      // Fire-and-forget replicate
      if (typeof chrome !== 'undefined' && typeof chrome.cookies !== 'undefined') {
        chrome.cookies.set(altDetails, () => {
          if (chrome.runtime.lastError) {
            // ignore optional replicate errors
          }
        });
      }
    }
  }

  // Also ensure local studio cookies are injected if target is localhost or localhost:4000
  try {
    const primaryToken = typeof rawInput === 'string' && rawInput.length < 500 && !rawInput.includes('=') && !rawInput.includes('[')
      ? rawInput
      : parsedCookies.find((c) => c.name === defaultCookieName || c.name === 'flow_session' || c.name === 'OSID' || c.name === 'SID')?.value || '';

    if (primaryToken) {
      await setCookieSafe({
        url: 'http://localhost:4000/',
        name: 'flow_session',
        value: primaryToken,
        path: '/',
        secure: false,
      });
      await setCookieSafe({
        url: 'http://localhost:4000/',
        name: 'flow_delegated_session',
        value: primaryToken,
        path: '/',
        secure: false,
      });
    }
  } catch {}

  console.log(`[Flow Cookies] Injection summary: ${successful} succeeded, ${failed} failed.`);

  return {
    total: parsedCookies.length,
    successful,
    failed,
    details: results,
  };
}
