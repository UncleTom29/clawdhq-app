// Fetches a small amount of HTML from a user-supplied URL and extracts
// Open Graph / basic <title> metadata, so posts can show a rich link
// preview card client-side without the browser needing to fetch arbitrary
// third-party URLs directly (which would just fail on CORS for most sites).

const FETCH_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 512 * 1024; // 512KB is plenty for a <head>
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface LinkPreview {
    url: string;
    title: string | null;
    description: string | null;
    image: string | null;
    site_name: string | null;
}

export class LinkPreviewError extends Error {
    constructor(message: string, public code: string, public status = 400) {
        super(message);
    }
}

const cache = new Map<string, { data: LinkPreview; expiresAt: number }>();

// Blocks fetches aimed at internal infrastructure (cloud metadata
// endpoints, loopback, private ranges) — this endpoint takes an
// arbitrary user-supplied URL and fetches it server-side, so without this
// check it would be a ready-made SSRF probe into the backend's own network.
function assertPublicHttpUrl(rawUrl: string): URL {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new LinkPreviewError('Not a valid URL.', 'BAD_URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new LinkPreviewError('Only http/https URLs are supported.', 'BAD_URL');
    }

    const hostname = parsed.hostname.toLowerCase();
    const blockedHosts = ['localhost', '0.0.0.0', 'metadata.google.internal'];
    if (blockedHosts.includes(hostname)) {
        throw new LinkPreviewError('This URL cannot be previewed.', 'BLOCKED_HOST');
    }

    // IPv4 literal check — private/loopback/link-local ranges.
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
        const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
        const isPrivate =
            a === 10 ||
            a === 127 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168);
        if (isPrivate) {
            throw new LinkPreviewError('This URL cannot be previewed.', 'BLOCKED_HOST');
        }
    }

    return parsed;
}

function extractMeta(html: string, ...names: string[]): string | null {
    for (const name of names) {
        const patterns = [
            new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'),
            new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${name}["']`, 'i'),
            new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'),
            new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i'),
        ];
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match?.[1]) {
                return decodeHtmlEntities(match[1]);
            }
        }
    }
    return null;
}

function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'");
}

export async function getLinkPreview(rawUrl: string): Promise<LinkPreview> {
    const parsed = assertPublicHttpUrl(rawUrl);
    const cacheKey = parsed.toString();

    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(cacheKey, {
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ClawdHQLinkPreview/1.0; +https://clawdhq.xyz)',
                Accept: 'text/html',
            },
        });

        if (!response.ok) {
            throw new LinkPreviewError(`Fetch failed with status ${response.status}.`, 'FETCH_FAILED');
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
            throw new LinkPreviewError('URL does not return HTML.', 'NOT_HTML');
        }

        const reader = response.body?.getReader();
        let html = '';
        let bytesRead = 0;
        const decoder = new TextDecoder();
        if (reader) {
            while (bytesRead < MAX_RESPONSE_BYTES) {
                const { done, value } = await reader.read();
                if (done) break;
                bytesRead += value.byteLength;
                html += decoder.decode(value, { stream: true });
                // Once we have a closing </head>, no need to keep reading.
                if (html.includes('</head>')) break;
            }
            reader.cancel().catch(() => {});
        }

        const preview: LinkPreview = {
            url: cacheKey,
            title: extractMeta(html, 'og:title') || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null),
            description: extractMeta(html, 'og:description', 'description'),
            image: extractMeta(html, 'og:image'),
            site_name: extractMeta(html, 'og:site_name') || parsed.hostname,
        };

        cache.set(cacheKey, { data: preview, expiresAt: Date.now() + CACHE_TTL_MS });
        return preview;
    } catch (error) {
        if (error instanceof LinkPreviewError) throw error;
        if (error instanceof Error && error.name === 'AbortError') {
            throw new LinkPreviewError('Timed out fetching URL.', 'TIMEOUT');
        }
        throw new LinkPreviewError('Could not fetch URL.', 'FETCH_FAILED');
    } finally {
        clearTimeout(timeout);
    }
}
