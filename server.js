require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', true); // proxy/CDN mögött kell a helyes IP/protocol-hoz

const PORT = process.env.PORT || 3000;
const MAIN_WEBHOOK = process.env.MAIN_WEBHOOK;
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK;
const PROXYCHECK_API_KEY = process.env.PROXYCHECK_API_KEY;

/* =========================
   IP normalizálás + IP lekérés
   ========================= */
function normalizeIp(ip) {
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7); // IPv6-mapped IPv4 -> IPv4
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
  .split(',')
  .map(s => normalizeIp(s.trim()))
  .filter(Boolean);

const MY_IPS = (process.env.MY_IP || '')
  .split(',')
  .map(s => normalizeIp(s.trim()))
  .filter(Boolean);

/* =======================================
   Rossz kombináció számláló és IP tiltás
   ======================================= */
const failedCombos = new Map(); // ip -> { count, firstAt }
const bannedIPs   = new Map();  // ip -> expiresAt (ms)

const MAX_FAILS       = 10;                       // ennyi "rossz kombináció" után tiltunk
const FAIL_WINDOW_MS  = 24 * 60 * 60 * 1000;      // 24 óra ablak
const BAN_DURATION_MS = 24 * 60 * 60 * 1000;      // 24 óra tiltás

function isIpBanned(ip) {
  const until = bannedIPs.get(ip);
  if (!until) return false;
  if (Date.now() > until) { bannedIPs.delete(ip); return false; }
  return true;
}
function remainingBanMs(ip) {
  const until = bannedIPs.get(ip);
  return until ? Math.max(0, until - Date.now()) : 0;
}
function registerFailedCombo(ip) {
  const now = Date.now();
  const rec = failedCombos.get(ip);
  if (!rec) { failedCombos.set(ip, { count: 1, firstAt: now }); return 1; }
  if (now - rec.firstAt > FAIL_WINDOW_MS) { failedCombos.set(ip, { count: 1, firstAt: now }); return 1; }
  rec.count += 1; failedCombos.set(ip, rec); return rec.count;
}
function banIp(ip) { bannedIPs.set(ip, Date.now() + BAN_DURATION_MS); }

// időnkénti takarítás
setInterval(() => {
  const now = Date.now();
  for (const [ip, until] of bannedIPs.entries()) if (now > until) bannedIPs.delete(ip);
  for (const [ip, rec] of failedCombos.entries()) if (now - rec.firstAt > FAIL_WINDOW_MS) failedCombos.delete(ip);
}, 60 * 60 * 1000);

/* =========================
   Discord üzenetekhez geo formázók
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

// --- VPN/PROXY LOG (MINDEN infóval – a te részletes verziód) ---
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

// --- RIASZTÁS LOG (minden infóval + teljes URL támogatás – a te részletes verziód) ---
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
   GLOBÁLIS BAN-MIDDLEWARE (legfelül fusson)
   ========================= */
app.use((req, res, next) => {
  const ip = getClientIp(req);
  const isMyIp = MY_IPS.includes(ip);
  const whitelisted = WHITELISTED_IPS.includes(ip);

  if (!isMyIp && !whitelisted && isIpBanned(ip)) {
    const leftHrs = Math.ceil(remainingBanMs(ip) / (60 * 60 * 1000));
    return res.status(403).send(`Az IP címed ideiglenesen tiltva van (~${leftHrs} óra). 🚫`);
  }
  next();
});

/* =========================
   KÖZPONTI HTML LOGOLÓ + VPN SZŰRŐ
   (MINDIG express.static ELÉ!)
   ========================= */
app.use(async (req, res, next) => {
  const publicDir = path.join(__dirname, 'public');
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const cleanPath = decodeURIComponent(req.path).replace(/^\/+/, '');

  let servesHtml = false;

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (req.path === '/') {
      // nálad a főoldal is HTML (később a / route a szaby/index.html-t adja)
      servesHtml = true;
    } else if (cleanPath.toLowerCase().endsWith('.html')) {
      servesHtml = fs.existsSync(path.join(publicDir, cleanPath));
    } else if (!path.extname(cleanPath)) {
      servesHtml = fs.existsSync(path.join(publicDir, cleanPath, 'index.html'));
    }
  }

  if (!servesHtml) return next();

  const ip = getClientIp(req);
  const isMyIp = MY_IPS.includes(ip);
  const whitelisted = WHITELISTED_IPS.includes(ip);

  // Fő log
  const geoData = await getGeo(ip);
  if (!isMyIp) {
    axios.post(MAIN_WEBHOOK, {
      username: "Helyszíni Naplózó <3",
      avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
      content: '',
      embeds: [{
        title: 'Új látogató az oldalon! (HTML)',
        description: `**Oldal:** ${fullUrl}\n` + formatGeoDataTeljes(geoData),
        color: 0x800080
      }]
    }).catch(()=>{});
  }

  // VPN/proxy tiltás (whitelist kivétel)
  const vpnCheck = await isVpnProxy(ip);
  if (vpnCheck && !whitelisted) {
    if (!isMyIp) {
      axios.post(ALERT_WEBHOOK, {
        username: "VPN figyelő <3",
        avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
        content: '',
        embeds: [{
          title: 'VPN/proxy vagy TOR-ral próbálkozás! (HTML)',
          description: `**Oldal:** ${fullUrl}\n` + formatGeoDataVpn(geoData),
          color: 0xff0000
        }]
      }).catch(()=>{});
    }
    return res.status(403).send('VPN/proxy vagy TOR használata tiltott ezen az oldalon! 🚫');
  }

  if (whitelisted) console.log(`✅ Engedélyezett VPN/proxy IP (HTML): ${ip}`);

  next();
});

/* =========================
   Statikus fájlok kiszolgálása
   ========================= */
app.use(express.static(path.join(__dirname, 'public')));

/* =========================
   Route-ok
   ========================= */
// Főoldal: / -> public/szaby/index.html
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'szaby', 'index.html');
  return fs.existsSync(filePath)
    ? res.sendFile(filePath)
    : res.status(404).send('Főoldal nem található');
});

// Dinamikus mappák: /:folder -> public/:folder/index.html
app.get('/:folder', (req, res, next) => {
  const folderName = req.params.folder;
  if (folderName === 'report') return next();

  const filePath = path.join(__dirname, 'public', folderName, 'index.html');
  if (!fs.existsSync(filePath)) return next();
  return res.sendFile(filePath);
});

// Gyanús tevékenység reportolása
app.post('/report', express.json(), async (req, res) => {
  const ip = getClientIp(req);
  const { reason, page } = req.body;
  const geoData = await getGeo(ip);

  // Forrás URL (page -> Referer -> saját URL)
  const ownUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const fromUrl = page || req.get('referer') || ownUrl;

  // már tiltott?
  if (!MY_IPS.includes(ip) && !WHITELISTED_IPS.includes(ip) && isIpBanned(ip)) {
    return res.status(403).json({ ok: false, banned: true, retryAfterMs: remainingBanMs(ip) });
  }

  // "rossz kombináció" számlálás és tiltás
  const isBadCombo = typeof reason === 'string' && reason.toLowerCase().includes('rossz kombináció');
  if (isBadCombo && !MY_IPS.includes(ip) && !WHITELISTED_IPS.includes(ip)) {
    const count = registerFailedCombo(ip);

    if (count >= MAX_FAILS) {
      banIp(ip);

      axios.post(ALERT_WEBHOOK, {
        username: "Riasztóbot <3",
        avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
        content: '',
        embeds: [{
          title: 'IP tiltva 24 órára (10× rossz kombináció)',
          description: `**Oldal:** ${fromUrl}\n**IP:** ${ip}\n` + formatGeoDataReport(geoData, fromUrl),
          color: 0xff0000
        }]
      }).catch(()=>{});

      return res.status(429).json({ ok: false, banned: true, banMs: BAN_DURATION_MS });
    } else {
      const left = MAX_FAILS - count;
      if (left <= 2) {
        axios.post(ALERT_WEBHOOK, {
          username: "Riasztóbot <3>",
          avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
          content: '',
          embeds: [{
            title: 'Közel a tiltáshoz',
            description: `**Oldal:** ${fromUrl}\n**IP:** ${ip}\n**Hibák száma:** ${count}/${MAX_FAILS}`,
            color: 0xFFA500
          }]
        }).catch(()=>{});
      }
      return res.json({ ok: true, fails: count, remainingUntilBan: left });
    }
  }

  // Általános riasztás (egyéb ok)
  if (!MY_IPS.includes(ip)) {
    axios.post(ALERT_WEBHOOK, {
      username: "Riasztóbot <3",
      avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
      content: '',
      embeds: [{
        title: 'Gyanús tevékenység!',
        description: `**Művelet:** ${reason || 'Ismeretlen'}\n` + formatGeoDataReport(geoData, fromUrl),
        color: 0xff0000
      }]
    }).catch(()=>{});
  } else {
    console.log("Saját IP – report (ALERT webhook) kihagyva.");
  }

  res.json({ ok: true });
});

// 404 minden másra
app.use((req, res) => {
  res.status(404).send('404 Not Found');
});

app.listen(PORT, () => {
  console.log(`Szerver elindult: http://localhost:${PORT}`);
});
