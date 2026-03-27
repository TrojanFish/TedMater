import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// SSRF protection — only TED CDN domains allowed
const ALLOWED_HOSTS = ["hls.ted.com", "tedcdn.com", "assets.ted.com", "pa.tedcdn.com"];

function isAllowedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h))
    );
  } catch {
    return false;
  }
}

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
  "Referer": "https://www.ted.com/",
  "Origin": "https://www.ted.com",
};

async function fetchBuf(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Minimal MPEG-TS → ADTS AAC demuxer ──────────────────────────

const TS_SIZE = 188;

/** Parse PAT → return PMT PID, or -1 if not found */
function parsePmtPid(pkt: Buffer): number {
  // payload_unit_start must be set for table parsing
  if (!((pkt[1] >> 6) & 1)) return -1;
  const adaptation = (pkt[3] >> 4) & 0x03;
  let off = 4;
  if (adaptation === 0b11) off += 1 + pkt[4];
  if (off >= TS_SIZE) return -1;

  const pointer = pkt[off]; // pointer_field
  const p = off + 1 + pointer; // start of section
  if (p + 12 > pkt.length) return -1;

  const sectionLen = ((pkt[p + 1] & 0x0f) << 8) | pkt[p + 2];
  const end = Math.min(p + 3 + sectionLen - 4, pkt.length - 4); // exclude CRC

  for (let j = p + 8; j + 3 < end; j += 4) {
    const progNum = (pkt[j] << 8) | pkt[j + 1];
    const pmtPid = ((pkt[j + 2] & 0x1f) << 8) | pkt[j + 3];
    if (progNum !== 0) return pmtPid;
  }
  return -1;
}

/** Parse PMT → return audio elementary PID, or -1 */
function parseAudioPid(pkt: Buffer): number {
  if (!((pkt[1] >> 6) & 1)) return -1;
  const adaptation = (pkt[3] >> 4) & 0x03;
  let off = 4;
  if (adaptation === 0b11) off += 1 + pkt[4];
  if (off >= TS_SIZE) return -1;

  const pointer = pkt[off];
  const p = off + 1 + pointer;
  if (p + 12 > pkt.length) return -1;

  const sectionLen = ((pkt[p + 1] & 0x0f) << 8) | pkt[p + 2];
  const progInfoLen = ((pkt[p + 10] & 0x0f) << 8) | pkt[p + 11];
  let si = p + 12 + progInfoLen;
  const end = Math.min(p + 3 + sectionLen - 4, pkt.length);

  while (si + 4 < end) {
    const streamType = pkt[si];
    const ePid = ((pkt[si + 1] & 0x1f) << 8) | pkt[si + 2];
    const esInfoLen = ((pkt[si + 3] & 0x0f) << 8) | pkt[si + 4];
    // 0x03 MPEG-1 audio, 0x04 MPEG-2 audio, 0x0F AAC ADTS, 0x11 AAC LATM
    if (streamType === 0x03 || streamType === 0x04 || streamType === 0x0f || streamType === 0x11) {
      return ePid;
    }
    si += 5 + esInfoLen;
  }
  return -1;
}

/**
 * Extract raw audio elementary stream bytes from one TS segment buffer.
 * Returns ADTS AAC bytes ready for AudioContext.decodeAudioData().
 */
function demuxTs(ts: Buffer): Buffer {
  let pmtPid = -1;
  let audioPid = -1;

  // First pass: discover PIDs from the first few packets
  for (let i = 0; i + TS_SIZE <= ts.length && (pmtPid < 0 || audioPid < 0); i += TS_SIZE) {
    if (ts[i] !== 0x47) continue;
    const pid = ((ts[i + 1] & 0x1f) << 8) | ts[i + 2];
    const pkt = ts.subarray(i, i + TS_SIZE);

    if (pid === 0x0000 && pmtPid < 0) {
      pmtPid = parsePmtPid(pkt);
    } else if (pmtPid > 0 && pid === pmtPid && audioPid < 0) {
      audioPid = parseAudioPid(pkt);
    }
  }

  if (audioPid < 0) return Buffer.alloc(0);

  // Second pass: collect audio PES packets → extract payload
  const chunks: Buffer[] = [];
  let pesBuf: Buffer | null = null;

  const flushPes = () => {
    if (!pesBuf || pesBuf.length < 9) return;
    const startCode = (pesBuf[0] << 16) | (pesBuf[1] << 8) | pesBuf[2];
    if (startCode !== 0x000001) return;
    const pesHeaderLen = pesBuf[8];
    const audio = pesBuf.subarray(9 + pesHeaderLen);
    if (audio.length > 0) chunks.push(audio);
  };

  for (let i = 0; i + TS_SIZE <= ts.length; i += TS_SIZE) {
    if (ts[i] !== 0x47) continue;
    const pid = ((ts[i + 1] & 0x1f) << 8) | ts[i + 2];
    if (pid !== audioPid) continue;

    const payloadStart = (ts[i + 1] >> 6) & 1;
    const adaptation = (ts[i + 3] >> 4) & 0x03;
    if (adaptation === 0b10) continue; // adaptation only, no payload

    let off = 4;
    if (adaptation === 0b11) off += 1 + ts[i + 4];
    if (off >= TS_SIZE) continue;

    const payload = ts.subarray(i + off, i + TS_SIZE);

    if (payloadStart) {
      flushPes();
      pesBuf = Buffer.from(payload);
    } else if (pesBuf) {
      pesBuf = Buffer.concat([pesBuf, payload]);
    }
  }
  flushPes();

  return chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
}

// ── M3U8 parsing helpers ─────────────────────────────────────────

function resolveUrl(href: string, base: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  return new URL(href, base).toString();
}

/**
 * Given a master or media M3U8 URL, return:
 *  - the media playlist URL to use (audio-only preferred, else lowest bitrate)
 *  - the segment URLs in order
 */
async function resolveSegments(m3u8Url: string): Promise<string[]> {
  const text = (await fetchBuf(m3u8Url)).toString("utf-8");
  const base = m3u8Url;

  const isMaster = text.includes("#EXT-X-STREAM-INF") || text.includes("#EXT-X-MEDIA:TYPE=AUDIO");

  if (!isMaster) {
    // Already a media playlist
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => resolveUrl(l, base));
  }

  // Try audio-only GROUP first (smaller, no video demux needed)
  const audioUriMatch = text.match(/TYPE=AUDIO[^\n]*URI="([^"]+)"/);
  if (audioUriMatch) {
    const audioM3u8 = resolveUrl(audioUriMatch[1], base);
    if (isAllowedUrl(audioM3u8)) {
      const mediaTxt = (await fetchBuf(audioM3u8)).toString("utf-8");
      const segs = mediaTxt
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => resolveUrl(l, audioM3u8));
      if (segs.length > 0) return segs;
    }
  }

  // Fall back to lowest-bandwidth video+audio variant
  const variants: { bw: number; url: string }[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
    const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);
    const bw = bwMatch ? parseInt(bwMatch[1]) : 999_999_999;
    const varLine = lines[i + 1]?.trim();
    if (varLine && !varLine.startsWith("#")) {
      variants.push({ bw, url: resolveUrl(varLine, base) });
    }
  }
  variants.sort((a, b) => a.bw - b.bw);

  if (variants.length === 0) throw new Error("No playable variants found in master playlist");
  if (!isAllowedUrl(variants[0].url)) throw new Error("Variant URL not allowed");

  const mediaTxt = (await fetchBuf(variants[0].url)).toString("utf-8");
  return mediaTxt
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => resolveUrl(l, variants[0].url));
}

// ── Route handler ────────────────────────────────────────────────

const CONCURRENCY = 8;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const m3u8Url = searchParams.get("url");

  if (!m3u8Url) return NextResponse.json({ error: "Missing url" }, { status: 400 });
  if (!isAllowedUrl(m3u8Url)) return NextResponse.json({ error: "URL not allowed" }, { status: 403 });

  try {
    const segUrls = await resolveSegments(m3u8Url);
    if (segUrls.length === 0) return NextResponse.json({ error: "No segments" }, { status: 500 });

    // Filter to allowed hosts only
    const safe = segUrls.filter(isAllowedUrl);
    if (safe.length === 0) return NextResponse.json({ error: "No allowed segments" }, { status: 403 });

    // Fetch + demux in batches; use allSettled so one bad segment doesn't abort the rest
    const adtsChunks: Buffer[] = [];
    for (let i = 0; i < safe.length; i += CONCURRENCY) {
      const batch = safe.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(batch.map(fetchBuf));
      for (const r of results) {
        if (r.status === "rejected") { console.warn("[extract-audio] segment failed:", r.reason); continue; }
        const adts = demuxTs(r.value);
        if (adts.length > 0) adtsChunks.push(adts);
      }
    }

    if (adtsChunks.length === 0) {
      return NextResponse.json({ error: "No audio data extracted from segments" }, { status: 500 });
    }

    const combined = Buffer.concat(adtsChunks);

    return new NextResponse(combined, {
      status: 200,
      headers: {
        "Content-Type": "audio/aac",
        "Content-Length": combined.length.toString(),
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    console.error("[extract-audio]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
