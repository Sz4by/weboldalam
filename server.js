require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', true);

const PORT = process.env.PORT || 3000;
const MAIN_WEBHOOK = process.env.MAIN_WEBHOOK;
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK;
const PROXYCHECK_API_KEY = process.env.PROXYCHECK_API_KEY;

// ================== IP normalizálás + lekérés ==================
function normalizeIp(ip) {
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
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

// ================== Whitelist és saját IP-k ==================
const WHITELISTED_IPS = (process.env.ALLOWED_VPN_IPS || '').split(',').map(s => normalizeIp(s.trim())).filter(Boolean);
const MY_IPS = (process.env.MY_IP || '').split(',').map(s => normalizeIp(s.trim())).filter(Boolean);

// ================== IP tiltások memóriában (24 óra) ==================
const bannedIPs = new Map();
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
setInterval(() => {
  const now = Date.now();
  for (const [ip, until] of bannedIPs.entries()) if (now > until) bannedIPs.delete(ip);
}, 60 * 60 * 1000);

// ================== TARTÓS rossz kombináció számláló (JSON fájl) ==================
const DATA_DIR = path.join(__dirname, 'data');
const FAIL_FILE = path.join(DATA_DIR, 'failedAttempts.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let failedAttempts = Object.create(null); // { "ip": number }
try {
  if (fs.existsSync(FAIL_FILE)) {
    const raw = fs.readFileSync(FAIL_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') failedAttempts = parsed;
  }
} catch { failedAttempts = Object.create(null); }

function saveFailedAttempts() {
  try {
    const tmp = FAIL_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(failedAttempts, null, 2));
    fs.renameSync(tmp, FAIL_FILE);
  } catch (e) {
    console.log('failedAttempts mentési hiba:', e.message);
  }
}

const MAX_ATTEMPTS = 10;

// ================== Részletes GEO formázók – KÜLÖN-KÜLÖN ==================
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

// ================== GEO lekérés és VPN ellenőrzés ==================
async function getGeo(ip) {
  try {
    const geo = await axios.get(`https://ipwhois.app/json/${ip}`);
    if (geo.data.success === false || geo.data.type === 'error') return {};
    return geo.data;
  } catch { return {}; }
}
async function isVpnProxy(ip) {
  try {
    const url = `https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=1&asn=1&node=1`;
    const res = await axios.get(url);
    if (res.data && res.data[ip]) {
      return res.data[ip].proxy === "yes" || res.data[ip].type === "VPN";
    }
    return false;
  } catch { return false; }
}

// ================== GLOBÁLIS IP BAN middleware ==================
app.use((req, res, next) => {
  const ip = getClientIp(req);
  if (!MY_IPS.includes(ip) && !WHITELISTED_IPS.includes(ip) && isIpBanned(ip)) {
    const page = path.join(__dirname, 'public', 'banned-ip.html');
    if (fs.existsSync(page)) return res.redirect('/banned-ip.html'); // azonnali ÁTIRÁNYÍTÁS
    return res.status(403).send(`Az IP címed ideiglenesen tiltva van (~${Math.ceil(remainingBanMs(ip)/(60*60*1000))} óra). 🚫`);
  }
  next();
});

// ================== Központi HTML logoló + VPN szűrő ==================
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
  const geoData = await getGeo(ip);

  if (!MY_IPS.includes(ip)) {
    axios.post(MAIN_WEBHOOK, {
      username: "HTML log",
      embeds: [{
        title: 'Új HTML látogató',
        description: `**Oldal:** ${fullUrl}\n` + formatGeoDataTeljes(geoData),
        color: 0x800080
      }]
    }).catch(()=>{});
  }

  const vpnCheck = await isVpnProxy(ip);
  if (vpnCheck && !MY_IPS.includes(ip) && !WHITELISTED_IPS.includes(ip)) {
    axios.post(ALERT_WEBHOOK, {
      username: "VPN figyelő",
      embeds: [{
        title: 'VPN/proxy vagy TOR észlelve',
        description: `**Oldal:** ${fullUrl}\n` + formatGeoDataVpn(geoData),
        color: 0xff0000
      }]
    }).catch(()=>{});
    const bannedVpnPage = path.join(__dirname, 'public', 'banned-vpn.html');
    if (fs.existsSync(bannedVpnPage)) return res.redirect('/banned-vpn.html'); // ÁTIRÁNYÍTÁS
    return res.status(403).send('VPN/proxy vagy TOR használata tiltott! 🚫');
  }

  next();
});

// ================== Statikus fájlok ==================
app.use(express.static(path.join(__dirname, 'public')));

// ================== FŐOLDAL: mindig /public/szaby/index.html (URL-ben NINCS /szaby) ==================
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'szaby', 'index.html');
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  return res.status(404).send('Főoldal nem található');
});

// ================== Admin kézi IP ban ==================
app.post('/admin/ban', express.json(), (req, res) => {
  const secret = req.headers['x-ban-secret'];
  if (secret !== process.env.BAN_SECRET) return res.status(401).json({ ok:false, error:'unauthorized' });
  const targetIp = normalizeIp(req.body?.ip || '');
  if (!targetIp) return res.status(400).json({ ok:false, error:'missing ip' });
  banIp(targetIp);
  return res.json({ ok:true, bannedIp: targetIp, remainingMs: remainingBanMs(targetIp) });
});

// ================== REPORT: minden /report = rossz kombináció ==================
app.post('/report', express.json(), async (req, res) => {
  const ip = getClientIp(req);
  const { reason, page } = req.body || {};
  const geoData = await getGeo(ip);
  const fromUrl = page || req.get('referer') || `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  if (!MY_IPS.includes(ip) && !WHITELISTED_IPS.includes(ip)) {
    // számláló növelés + mentés fájlba
    const current = Number(failedAttempts[ip] || 0) + 1;
    failedAttempts[ip] = current;
    saveFailedAttempts();

    // log minden próbáról
    axios.post(ALERT_WEBHOOK, {
      username: "Rossz kombináció",
      embeds: [{
        title: `Rossz kombináció próbálkozás (${current}/${MAX_ATTEMPTS})`,
        description: `**IP:** ${ip}\n**Művelet:** ${reason || 'ismeretlen'}\n` + formatGeoDataReport(geoData, fromUrl),
        color: 0xffa500
      }]
    }).catch(()=>{});

    if (current >= MAX_ATTEMPTS) {
      banIp(ip);
      // nullázd a számlálót a ban kezdetén (hogy új ablak induljon a feloldás után)
      delete failedAttempts[ip];
      saveFailedAttempts();

      // piros riasztás
      axios.post(ALERT_WEBHOOK, {
        username: "IP Tiltás",
        embeds: [{
          title: 'IP 24 órára tiltva (max próbálkozás elérve)',
          description: `**IP:** ${ip}\n` + formatGeoDataReport(geoData, fromUrl),
          color: 0xff0000
        }]
      }).catch(()=>{});

      // AZONNALI ÁTIRÁNYÍTÁS a tiltó oldalra
      const bannedPage = path.join(__dirname, 'public', 'banned-ip.html');
      if (fs.existsSync(bannedPage)) return res.redirect('/banned-ip.html');
      return res.status(403).send('Az IP címed ideiglenesen tiltva lett (24h). 🚫');
    }
  }

  return res.json({ ok: true });
});

// ================== 404 ==================
app.use((req, res) => {
  res.status(404).send('404 Not Found');
});

app.listen(PORT, () => {
  console.log(`Szerver elindult: http://localhost:${PORT}`);
});
