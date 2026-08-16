 export const config = {
  matcher: '/((?!favicon.svg|robots.txt|sitemap.xml).*)',
};

const BLOCKED_UA_PATTERNS = [
  /axios/i,
  /python-requests/i,
  /curl/i,
  /wget/i,
  /scrapy/i,
  /node-fetch/i,
  /go-http-client/i,
  /postmanruntime/i,
  /okhttp/i,
  /libwww-perl/i,
  /java\/\d/i,
  /httpclient/i,
  /^$/, // UA kosong -> hampir pasti bukan browser
];

// Rate limit: max N request per window per IP.
// Catatan: in-memory, best-effort (lihat keterangan di atas).
const WINDOW_MS = 10_000;
const MAX_REQUESTS_PER_WINDOW = 60;
const ipHits = new Map();

function isBlockedUA(ua) {
  return BLOCKED_UA_PATTERNS.some(re => re.test(ua));
}

function isRateLimited(ip) {
  const now = Date.now();
  const rec = ipHits.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) {
    ipHits.set(ip, { count: 1, start: now });
    return false;
  }
  rec.count++;
  return rec.count > MAX_REQUESTS_PER_WINDOW;
}

export default function middleware(req) {
  const ua = req.headers.get('user-agent') || '';

  if (isBlockedUA(ua)) {
    return new Response('Forbidden: automated client detected', { status: 403 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (ip !== 'unknown' && isRateLimited(ip)) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': '10' },
    });
  }
}
