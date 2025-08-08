require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', true); // ha proxy/CDN mögött futsz

const PORT = process.env.PORT || 3000;
const MAIN_WEBHOOK = process.env.MAIN_WEBHOOK;
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK;
const PROXYCHECK_API_KEY = process.env.PROXYCHECK_API_KEY;

/* =========================
   IP normalizálás + IP lekérés
   ========================= */
function normalizeIp(ip) {
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7); // IPv6-mapped IPv4
  if (ip === '::1') ip = '127.0.0.1';            // IPv6 localhost -> IPv4
  return ip.toLowerCase();
}
function getClientIp(req) {
  let ip =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : '') ||
    (req.socket.remoteAddress || req.connection.remoteAddress || '');
  return normalizeIp(ip);
}

/* =========================
   IP listák (whitelist/saját) normalizálva
   ========================= */
const WHITELISTED_IPS = (process.env.ALLOWED_VPN_IPS || '')
  .split(',').map(s => normalizeIp(s.trim())).filter(Boolean);
const MY_IPS = (process.env.MY_IP || '')
  .split(',').map(s => normalizeIp(s.trim())).filter(Boolean);

/* =======================================
   24 órás IP tiltás (memóriában)
   ======================================= */
const bannedIPs = new Map();  // ip -> expiresAt (ms)
const BAN_DURATION_MS = 24 * 60 * 60 * 1000;

function isIpBanned(ip) {
  const until = bannedIPs.get(ip);
  if (!until) return false;
  if (Date.now() > until) { bannedIPs.delete(ip); return false; }
  return true;
}
function banIp(ip) { bannedIPs.set(ip, Date.now() + BAN_DURATION_MS); }
function remainingBanMs(ip) {
  const until = bannedIPs.get(ip);
  return until ? Math.max(0, until - Date.now()) : 0;
}
setInterval(() => { // lejárt tiltások takarítása
  const now = Date.now();
  for (const [ip, until] of bannedIPs.entries()) if (now > until) bannedIPs.delete(ip);
}, 60 * 60 * 1000);

/* =======================================
   Rossz kombináció számláló (24 órás ablak)
   ======================================= */
const failedAttempts = new Map(); // ip -> { count, firstAt }
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;

function registerFailedAttempt(ip) {
  const now = Date.now();
  const rec = failedAttempts.get(ip);
  if (!rec) {
    failedAttempts.set(ip, { count: 1, firstAt: now });
    return 1;
  }
  // ha lejárt a 24 órás ablak, reset
  if (now - rec.firstAt > ATTEMPT_WINDOW_MS) {
    failedAttempts.set(ip, { count: 1, firstAt: now });
    return 1;
  }
  rec.count += 1;
  failedAttempts.set(ip, rec);
  return rec.count;
}
function getFailedAttempts(ip) {
  const rec = failedAttempts.get(ip);
  return rec ? rec.count : 0;
}

/* =========================
   Discord üzenetekhez geo formázók (RÉSZLETES)
   ========================= */
function formatGeoDataTeljes(geo) {
  return (
    `**IP-cím:** ${geo.ip || 'Ismeretlen'}\n` +
    `**Sikeres lekérdezés:** ${geo.success || 'Ismeretlen'}\n` +
    `**Típus:** ${geo.type || 'Ismeretlen'}\n` +
    `**Kontinens:** ${geo.continent || 'Ismeretlen'}\n` +
    `**Kontinens kód:** ${geo.continent_code || 'Ismeretlen'}\n` +
    `**Ország:** ${geo.country || 'Ismeretlen'}\n` +
    `**Országkód:** ${geo.country_code || 'Ismeretlen'}\n` +
    `**Ország zászló:** ${geo.country_flag || 'Ismeretlen'}\n` +
    `**Főváros:** ${geo.country_capital || 'Ismeretlen'}\n` +
    `**Ország hívószám:** ${geo.country_phone || 'Ismeretlen'}\n` +
    `**Szomszédos országok:** ${geo.country_neighbours || 'Ismeretlen'}\n` +
    `**Régió:** ${geo.region || 'Ismeretlen'}\n` +
    `**Város:** ${geo.city || 'Ismeretlen'}\n` +
    `**Szélesség:** ${geo.latitude || 'Ismeretlen'}\n` +
    `**Hosszúság:** ${geo.longitude || 'Ismeretlen'}\n` +
    `**ASN:** ${geo.asn || 'Ismeretlen'}\n` +
    `**Szervezet:** ${geo.org || 'Ismeretlen'}\n` +
    `**Hálózat:** ${geo.isp || 'Ismeretlen'}\n` +
    `**Időzóna:** ${geo.timezone || 'Ismeretlen'}\n` +
    `**Időzóna neve:** ${geo.timezone_name || 'Ismeretlen'}\n` +
    `**Időzóna nyári idő eltolás:** ${geo.timezone_dstOffset || 'Ismeretlen'}\n` +
    `**Időzóna GMT eltolás:** ${geo.timezone_gmtOffset || 'Ismeretlen'}\n` +
    `**Időzóna GMT:** ${geo.timezone_gmt || 'Ismeretlen'}\n` +
    `**Valuta:** ${geo.currency || 'Ismeretlen'}\n` +
    `**Valuta kód:** ${geo.currency_code || 'Ismeretlen'}\n` +
    `**Valuta szimbólum:** ${geo.currency_symbol || 'Ismeretlen'}\n` +
    `**Valuta árfolyam:** ${geo.currency_rates || 'Ismeretlen'}\n` +
    `**Valuta többes:** ${geo.currency_plural || 'Ismeretlen'}\n`
  );
}

// --- RÉSZLETES VPN/PROXY LOG (a te mintád szerint) ---
function formatGeoDataVpn(geo) {
  return (
    `**IP-cím:** ${geo.ip || 'Ismeretlen'}\n` +
    `**Sikeres lekérdezés:** ${geo.success || 'Ismeretlen'}\n` +
    `**Típus:** ${geo.type || 'Ismeretlen'}\n` +
    `**Kontinens:** ${geo.continent || 'Ismeretlen'}\n` +
    `**Kontinens kód:** ${geo.continent_code || 'Ismeretlen'}\n` +
    `**Ország:** ${geo.country || 'Ismeretlen'}\n` +
    `**Országkód:** ${geo.country_code || 'Ismeretlen'}\n` +
    `**Ország zászló:** ${geo.country_flag || 'Ismeretlen'}\n` +
    `**Főváros:** ${geo.country_capital || 'Ismeretlen'}\n` +
    `**Ország hívószám:** ${geo.country_phone || 'Ismeretlen'}\n` +
    `**Szomszédos országok:** ${geo.country_neighbours || 'Ismeretlen'}\n` +
    `**Régió:** ${geo.region || 'Ismeretlen'}\n` +
    `**Város:** ${geo.city || 'Ismeretlen'}\n` +
    `**Szélesség:** ${geo.latitude || 'Ismeretlen'}\n` +
    `**Hosszúság:** ${geo.longitude || 'Ismeretlen'}\n` +
    `**ASN:** ${geo.asn || 'Ismeretlen'}\n` +
    `**Szervezet:** ${geo.org || 'Ismeretlen'}\n` +
    `**Hálózat:** ${geo.isp || 'Ismeretlen'}\n` +
    `**Időzóna:** ${geo.timezone || 'Ismeretlen'}\n` +
    `**Időzóna neve:** ${geo.timezone_name || 'Ismeretlen'}\n` +
    `**Időzóna nyári idő eltolás:** ${geo.timezone_dstOffset || 'Ismeretlen'}\n` +
    `**Időzóna GMT eltolás:** ${geo.timezone_gmtOffset || 'Ismeretlen'}\n` +
    `**Időzóna GMT:** ${geo.timezone_gmt || 'Ismeretlen'}\n` +
    `**Valuta:** ${geo.currency || 'Ismeretlen'}\n` +
    `**Valuta kód:** ${geo.currency_code || 'Ismeretlen'}\n` +
    `**Valuta szimbólum:** ${geo.currency_symbol || 'Ismeretlen'}\n` +
    `**Valuta árfolyam:** ${geo.currency_rates || 'Ismeretlen'}\n` +
    `**Valuta többes:** ${geo.currency_plural || 'Ismeretlen'}\n`
  );
}

// --- RÉSZLETES REPORT LOG (teljes URL + minden mező, a te mintád szerint) ---
function formatGeoDataReport(geo, pageUrl) {
  return (
    (pageUrl ? `**Oldal:** ${pageUrl}\n` : '') +
    `**IP-cím:** ${geo.ip || 'Ismeretlen'}\n` +
    `**Sikeres lekérdezés:** ${geo.success || 'Ismeretlen'}\n` +
    `**Típus:** ${geo.type || 'Ismeretlen'}\n` +
    `**Kontinens:** ${geo.continent || 'Ismeretlen'}\n` +
    `**Kontinens kód:** ${geo.continent_code || 'Ismeretlen'}\n` +
    `**Ország:** ${geo.country || 'Ismeretlen'}\n` +
    `**Országkód:** ${geo.country_code || 'Ismeretlen'}\n` +
    `**Ország zászló:** ${geo.country_flag || 'Ismeretlen'}\n` +
    `**Főváros:** ${geo.country_capital || 'Ismeretlen'}\n` +
    `**Ország hívószám:** ${geo.country_phone || 'Ismeretlen'}\n` +
    `**Szomszédos országok:** ${geo.country_neighbours || 'Ismeretlen'}\n` +
    `**Régió:** ${geo.region || 'Ismeretlen'}\n` +
    `**Város:** ${geo.city || 'Ismeretlen'}\n` +
    `**Szélesség:** ${geo.latitude || 'Ismeretlen'}\n` +
    `**Hosszúság:** ${geo.longitude || 'Ismeretlen'}\n` +
    `**ASN:** ${geo.asn || 'Ismeretlen'}\n` +
    `**Szervezet:** ${geo.org || 'Ismeretlen'}\n` +
    `**Hálózat:** ${geo.isp || 'Ismeretlen'}\n` +
    `**Időzóna:** ${geo.timezone || 'Ismeretlen'}\n` +
    `**Időzóna neve:** ${geo.timezone_name || 'Ismeretlen'}\n` +
    `**Időzóna nyári idő eltolás:** ${geo.timezone_dstOffset || 'Ismeretlen'}\n` +
    `**Időzóna GMT eltolás:** ${geo.timezone_gmtOffset || 'Ismeretlen'}\n` +
    `**Időzóna GMT:** ${geo.timezone_gmt || 'Ismeretlen'}\n` +
    `**Valuta:** ${geo.currency || 'Ismeretlen'}\n` +
    `**Valuta kód:** ${geo.currency_code || 'Ismeretlen'}\n` +
    `**Valuta szimbólum:** ${geo.currency_symbol || 'Ismeretlen'}\n` +
    `**Valuta árfolyam:** ${geo.currency_rates || 'Ismeretlen'}\n` +
    `**Valuta többes:** ${geo.currency_plural || 'Ismeretlen'}\n`
  );
}

/* =========================
   Geo lekérés + VPN ellenőrzés
   ========================= */
async function getGeo(ip) {
  try {
    const geo = await axios.get(`https://ipwhois.app/json/${ip}`);
    if (geo.data.success === false || geo.data.type === 'error') return {};
    return geo.data;
  } catch (e) {
    console.log('ipwhois.app hiba:', e.message);
    return {};
  }
}
async function isVpnProxy(ip) {
  try {
    const url = `https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=1&asn=1&node=1`;
    const res = await axios.get(url);
    if (res.data && res.data[ip]) {
      return res.data[ip].proxy === "yes" || res.data[ip].type === "VPN";
    }
    return false;
  } catch (e) {
    console.log("proxycheck.io hiba:", e.message);
    return false;
  }
}

/* =========================
   GLOBÁLIS IP BAN CHECK (legfelül fusson)
   ========================= */
app.use((req, res, next) => {
  const ip = getClientIp(req);
  const isMyIp = MY_IPS.includes(ip);
  const whitelisted = WHITELISTED_IPS.includes(ip);

  if (!isMyIp && !whitelisted && isIpBanned(ip)) {
    const page = path.join(__dirname, 'public', 'banned-ip.html');
    if (fs.existsSync(page)) return res.status(403).sendFile(page);
    const leftHrs = Math.ceil(remainingBanMs(ip) / (60 * 60 * 1000));
    return res.status(403).send(`Az IP címed ideiglenesen tiltva van (~${leftHrs} óra). 🚫`);
  }
  next();
});

/* =========================
   KÖZPONTI HTML LOGOLÓ + VPN SZŰRŐ
   ========================= */
app.use(async (req, res, next) => {
  const publicDir = path.join(__dirname, 'public');
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const cleanPath = decodeURIComponent(req.path).replace(/^\/+/, '');

  let servesHtml = false;
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (req.path === '/') servesHtml = true;
    else if (cleanPath.toLowerCase().endsWith('.html')) {
      servesHtml = fs.existsSync(path.join(publicDir, cleanPath));
    } else if (!path.extname(cleanPath)) {
      servesHtml = fs.existsSync(path.join(publicDir, cleanPath, 'index.html'));
    }
  }
  if (!servesHtml) return next();

  const ip = getClientIp(req);
  const isMyIp = MY_IPS.includes(ip);
  const whitelisted = WHITELISTED_IPS.includes(ip);

  const geoData = await getGeo(ip);
  if (!isMyIp) {
    axios.post(MAIN_WEBHOOK, {
      username: "Helyszíni Naplózó <3",
      embeds: [{
        title: 'Új látogató az oldalon! (HTML)',
        description: `**Oldal:** ${fullUrl}\n` + formatGeoDataTeljes(geoData),
        color: 0x800080
      }]
    }).catch(()=>{});
  }

  const vpnCheck = await isVpnProxy(ip);
  if (vpnCheck && !whitelisted) {
    if (!isMyIp) {
      axios.post(ALERT_WEBHOOK, {
        username: "VPN figyelő <3",
        embeds: [{
          title: 'VPN/proxy vagy TOR-ral próbálkozás! (HTML)',
          description: `**Oldal:** ${fullUrl}\n` + formatGeoDataVpn(geoData),
          color: 0xff0000
        }]
      }).catch(()=>{});
    }
    const bannedVpnPage = path.join(__dirname, 'public', 'banned-vpn.html');
    if (fs.existsSync(bannedVpnPage)) return res.status(403).sendFile(bannedVpnPage);
    return res.status(403).send('VPN/proxy vagy TOR használata tiltott ezen az oldalon! 🚫');
  }

  next();
});

/* =========================
   Statikus fájlok
   ========================= */
app.use(express.static(path.join(__dirname, 'public')));

/* =========================
   Route-ok
   ========================= */
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'szaby', 'index.html');
  return fs.existsSync(filePath) ? res.sendFile(filePath) : res.status(404).send('Főoldal nem található');
});

app.get('/:folder', (req, res, next) => {
  const folderName = req.params.folder;
  if (folderName === 'report' || folderName === 'admin') return next();
  const filePath = path.join(__dirname, 'public', folderName, 'index.html');
  if (!fs.existsSync(filePath)) return next();
  return res.sendFile(filePath);
});

/* =========================
   ADMIN: kézi IP ban (POST /admin/ban)
   Header: x-ban-secret: <BAN_SECRET>
   Body: { "ip": "1.2.3.4" }
   ========================= */
app.post('/admin/ban', express.json(), (req, res) => {
  const secret = req.headers['x-ban-secret'];
  if (secret !== process.env.BAN_SECRET) return res.status(401).json({ ok:false, error:'unauthorized' });
  const targetIp = normalizeIp(req.body?.ip || '');
  if (!targetIp) return res.status(400).json({ ok:false, error:'missing ip' });
  banIp(targetIp);
  return res.json({ ok:true, bannedIp: targetIp, remainingMs: remainingBanMs(targetIp) });
});

/* =========================
   REPORT: csak "rossz kombináció" számít (10x/24h => ban)
   ========================= */
app.post('/report', express.json(), async (req, res) => {
  const ip = getClientIp(req);
  const { reason, page } = req.body || {};
  const geoData = await getGeo(ip);

  const ownUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const fromUrl = page || req.get('referer') || ownUrl;

  // reason normalizálása: ékezet/szóköz/nagybetű ne számítson
  const rawReason = (reason ?? '').toString();
  const reasonText = rawReason
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();

  const isBadCombo = reasonText.includes('rossz kombinacio');

  if (isBadCombo && !MY_IPS.includes(ip) && !WHITELISTED_IPS.includes(ip)) {
    const attempts = registerFailedAttempt(ip);

    // minden próbálkozásról mehet jelzés
    axios.post(ALERT_WEBHOOK, {
      username: "Riasztóbot <3",
      embeds: [{
        title: attempts >= MAX_ATTEMPTS ? 'IP TILTVA (10× rossz kombináció)' : 'Rossz kombináció észlelve',
        description:
          `**Oldal:** ${fromUrl}\n` +
          `**IP:** ${ip}\n` +
          `**Próbálkozások:** ${attempts}/${MAX_ATTEMPTS}\n` +
          formatGeoDataReport(geoData, fromUrl),
        color: attempts >= MAX_ATTEMPTS ? 0xff0000 : 0xffa500
      }]
    }).catch(()=>{});

    if (attempts >= MAX_ATTEMPTS) {
      banIp(ip);
      const bannedPage = path.join(__dirname, 'public', 'banned-ip.html');
      return fs.existsSync(bannedPage)
        ? res.status(403).sendFile(bannedPage)
        : res.status(403).send('Az IP címed ideiglenesen tiltva lett (24h). 🚫');
    }

    return res.json({ ok: true, attempts, remainingUntilBan: Math.max(0, MAX_ATTEMPTS - attempts) });
  }

  // ha nem "rossz kombináció", csak OK
  return res.json({ ok: true, ignored: true });
});

/* =========================
   404 minden másra
   ========================= */
app.use((req, res) => {
  res.status(404).send('404 Not Found');
});

app.listen(PORT, () => {
  console.log(`Szerver elindult: http://localhost:${PORT}`);
});
