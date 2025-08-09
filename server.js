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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // jelszó az /admin oldalhoz

/* =========================
   IP normalizálás + IP lekérés
   ========================= */
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

/* =========================
   IP listák (whitelist/saját)
   ========================= */
const WHITELISTED_IPS = (process.env.ALLOWED_VPN_IPS || '')
  .split(',').map(s => normalizeIp(s.trim())).filter(Boolean);
const MY_IPS = (process.env.MY_IP || '')
  .split(',').map(s => normalizeIp(s.trim())).filter(Boolean);

/* =========================
   24 órás IP tiltás (memóriában)
   ========================= */
const bannedIPs = new Map(); // ip -> expiresAt
const BAN_DURATION_MS = 24 * 60 * 60 * 1000;

function isIpBanned(ip) {
  const until = bannedIPs.get(ip);
  if (!until) return false;
  if (Date.now() > until) { bannedIPs.delete(ip); return false; }
  return true;
}
function banIp(ip) { bannedIPs.set(ip, Date.now() + BAN_DURATION_MS); }
function unbanIp(ip) { bannedIPs.delete(ip); } // egy IP feloldása
function remainingBanMs(ip) {
  const until = bannedIPs.get(ip);
  return until ? Math.max(0, until - Date.now()) : 0;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, until] of bannedIPs.entries()) if (now > until) bannedIPs.delete(ip);
}, 60 * 60 * 1000);

/* =========================
   Rossz kombináció számláló (memóriában, napi reset)
   ========================= */
const badCombAttempts = new Map(); // ip -> { count, firstAttempt }
const MAX_BAD_ATTEMPTS = 10;
const ATTEMPT_RESET_MS = 24 * 60 * 60 * 1000; // 24 óra

function recordBadAttempt(ip) {
  const data = badCombAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };
  if (Date.now() - data.firstAttempt > ATTEMPT_RESET_MS) {
    data.count = 0;
    data.firstAttempt = Date.now();
  }
  data.count++;
  badCombAttempts.set(ip, data);
  return data.count;
}

/* =========================
   RÉSZLETES GEO LOG LISTÁK (3 KÜLÖN)
   ========================= */
// 1) TELJES lista – általános HTML látogatókhoz
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

// 2) VPN/Proxy lista – VPN riasztásokhoz
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

// 3) REPORT lista – rossz kombinációkhoz (TELJES URL-el)
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
  } catch {
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
  } catch {
    return false;
  }
}

// =========================
// Banned oldalak direkt route-ok
// =========================
app.get('/banned-ip.html', (req, res) => {
  const p = path.join(__dirname, 'public', 'banned-ip.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send('banned-ip.html hiányzik a /public-ból');
});

app.get('/banned-vpn.html', (req, res) => {
  const p = path.join(__dirname, 'public', 'banned-vpn.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send('banned-vpn.html hiányzik a /public-ból');
});

app.get('/banned-permanent.html', (req, res) => {
  const p = path.join(__dirname, 'public', 'banned-permanent.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send('banned-permanent.html hiányzik a /public-ból');
});

// =========================
// Globális IP ban middleware
// (banned oldalak átengedve)
// =========================
app.use((req, res, next) => {
  if (req.path === '/banned-ip.html' || req.path === '/banned-vpn.html' || req.path === '/banned-permanent.html') return next();

  const ip = getClientIp(req);
  if (!MY_IPS.includes(ip) && !WHITELISTED_IPS.includes(ip) && isIpBanned(ip)) {
    const page = path.join(__dirname, 'public', 'banned-ip.html');
    if (fs.existsSync(page)) return res.status(403).sendFile(page);
    return res.status(403).send('Az IP címed ideiglenesen tiltva van. 🚫');
  }
  next();
});

// =========================
// HTML logoló + VPN szűrő
// =========================
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
      username: "Látogató Naplózó",
      embeds: [{
        title: 'Új látogató (HTML)',
        description: `**Oldal:** ${fullUrl}\n` + formatGeoDataTeljes(geoData),
        color: 0x800080
      }]
    }).catch(()=>{});
  }

  const vpnCheck = await isVpnProxy(ip);
  if (vpnCheck && !WHITELISTED_IPS.includes(ip)) {
    axios.post(ALERT_WEBHOOK, {
      username: "VPN Figyelő",
      embeds: [{
        title: 'VPN/proxy vagy TOR!',
        description: `**Oldal:** ${fullUrl}\n` + formatGeoDataVpn(geoData),
        color: 0xff0000
      }]
    }).catch(()=>{});
    const bannedVpnPage = path.join(__dirname, 'public', 'banned-vpn.html');
    if (fs.existsSync(bannedVpnPage)) return res.status(403).sendFile(bannedVpnPage);
    return res.status(403).send('VPN/proxy vagy TOR használata tiltott! 🚫');
  }
  next();
});

// =========================
// Statikus fájlok
// =========================
app.use(express.static(path.join(__dirname, 'public')));

// =========================
// Főoldal: mindig szaby/index.html (URL-ben NINCS /szaby)
// =========================
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'szaby', 'index.html');
  return fs.existsSync(filePath) ? res.sendFile(filePath) : res.status(404).send('Főoldal nem található');
});

// =========================
// Admin – böngészős felület (GET /admin)
// =========================
app.get('/admin', (req, res) => {
  res.send(`<!doctype html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin – IP Ban/Unban</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;background:#0f1115;color:#e8eaf0;display:flex;min-height:100vh;align-items:center;justify-content:center}
  .card{background:#151922;padding:20px;border-radius:12px;box-shadow:0 6px 30px rgba(0,0,0,.4);max-width:440px;width:100%}
  h1{font-size:18px;margin:0 0 12px}
  label{display:block;margin:10px 0 4px;font-size:14px;color:#b6bdd1}
  input{width:100%;padding:10px;border-radius:10px;border:1px solid #2a3142;background:#0f131b;color:#e8eaf0}
  button{margin-top:12px;width:100%;padding:10px;border:0;border-radius:10px;background:#5865F2;color:white;font-weight:600;cursor:pointer}
  .row{display:flex;gap:8px}
  .row>button{flex:1}
  .msg{margin-top:10px;font-size:14px}
</style></head>
<body><div class="card">
  <h1>Admin – IP Ban / Unban</h1>
  <form id="adminForm">
    <label>Admin jelszó</label>
    <input name="password" type="password" placeholder="Admin jelszó" required>
    <label>IP cím</label>
    <input name="ip" placeholder="1.2.3.4" required>
    <div class="row">
      <button type="submit" data-action="ban">IP BAN 24h</button>
      <button type="submit" data-action="unban">IP UNBAN</button>
      <button type="submit" data-action="permanent-ban">IP VÉGLEGES BAN</button> <!-- Végleges tiltás gomb -->
    </div>
  </form>
  <div class="msg" id="msg"></div>
  <script>
    const form = document.getElementById('adminForm');
    const msg = document.getElementById('msg');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const action = e.submitter?.dataset?.action || 'ban';
      msg.textContent = 'Küldés...';
      const fd = new FormData(form);
      const body = new URLSearchParams();
      for (const [k,v] of fd) body.append(k,v);
      const url = action === 'ban' ? '/admin/ban/form' :
        action === 'unban' ? '/admin/unban/form' : '/admin/permanent-ban/form';
      const r = await fetch(url, {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body
      });
      const t = await r.text();
      msg.textContent = t;
      if (r.ok) form.reset();
    });
  </script>
</div></body></html>`);
});

// =========================
// Admin – BAN/UNBAN (HTML form, szerver oldali jelszóval)
// =========================
app.post('/admin/ban/form', express.urlencoded({ extended: true }), (req, res) => {
  const { password, ip } = req.body || {};
  if (!password || password !== ADMIN_PASSWORD) return res.status(401).send('Hibás admin jelszó.');
  const targetIp = normalizeIp((ip || '').trim());
  if (!targetIp) return res.status(400).send('Hiányzó IP.');
  banIp(targetIp);
  res.send(`✅ IP ${targetIp} tiltva lett 24 órára.`);
});

app.post('/admin/unban/form', express.urlencoded({ extended: true }), (req, res) => {
  const { password, ip } = req.body || {};
  if (!password || password !== ADMIN_PASSWORD) return res.status(401).send('Hibás admin jelszó.');
  const targetIp = normalizeIp((ip || '').trim());
  if (!targetIp) return res.status(400).send('Hiányzó IP.');
  if (bannedIPs.has(targetIp)) {
    unbanIp(targetIp);
    return res.send(`✅ IP ${targetIp} feloldva.`);
  } else {
    return res.status(404).send('❌ Ez az IP nincs tiltva.');
  }
});

// Memóriában tárolt véglegesen tiltott IP-k
let permanentBannedIPs = [];

// =========================
// Végleges tiltás (IP permanent-ban)
// =========================
app.post('/admin/permanent-ban/form', express.urlencoded({ extended: true }), (req, res) => {
  const { password, ip } = req.body || {};
  if (!password || password !== ADMIN_PASSWORD) return res.status(401).send('Hibás admin jelszó.');
  
  const targetIp = normalizeIp((ip || '').trim());
  if (!targetIp) return res.status(400).send('Hiányzó IP.');

  // Ellenőrizzük, hogy már le van-e tiltva memóriában
  if (permanentBannedIPs.includes(targetIp)) {
    return res.status(400).send(`❌ Az IP ${targetIp} már véglegesen le van tiltva.`);
  }

  // Véglegesen hozzáadjuk az IP-t a tiltott listához
  fs.readFile('banned-permanent-ips.json', 'utf8', (err, data) => {
    if (err) return res.status(500).send('Hiba történt a lista olvasásakor.');
    
    let bannedList;
    try {
      bannedList = JSON.parse(data);
      // Ellenőrizzük, hogy a bannedList tömb típusú-e
      if (!Array.isArray(bannedList)) {
        bannedList = [];  // Ha nem tömb, állítsuk be üres tömbre
      }
    } catch (parseError) {
      return res.status(500).send('A JSON fájl nem formázott helyesen.');
    }

    bannedList.push(targetIp);  // IP hozzáadása a fájlhoz
    permanentBannedIPs.push(targetIp);  // IP hozzáadása a memóriához

    fs.writeFile('banned-permanent-ips.json', JSON.stringify(bannedList, null, 2), (err) => {
      if (err) return res.status(500).send('Hiba történt a lista frissítésekor.');
      res.send(`✅ IP ${targetIp} véglegesen tiltva lett.`);
      
      // Discord log küldése
      axios.post(ALERT_WEBHOOK, {
        username: "IP Tiltó",
        embeds: [{
          title: 'Végleges tiltás!',
          description: `**IP-cím:** ${targetIp}\n**Akció:** Végleges tiltás`,
          color: 0xff0000
        }]
      }).catch(() => {});

      // Ha az IP véglegesen tiltva lett, akkor nyisd meg a "banned-permanent.html"-t
      const bannedPage = path.join(__dirname, 'public', 'banned-permanent.html');
      if (fs.existsSync(bannedPage)) {
        return res.status(403).sendFile(bannedPage); // közvetlen fájl
      } else {
        return res.status(403).send('Az IP véglegesen le van tiltva. 🚫');
      }
    });
  });
});

// =========================
// Végleges IP feloldás
// =========================
app.post('/admin/permanent-unban/form', express.urlencoded({ extended: true }), (req, res) => {
  const { password, ip } = req.body || {};
  if (!password || password !== ADMIN_PASSWORD) return res.status(401).send('Hibás admin jelszó.');
  
  const targetIp = normalizeIp((ip || '').trim());
  if (!targetIp) return res.status(400).send('Hiányzó IP.');

  // Törlés a végleges tiltott listából (memóriából és fájlból)
  fs.readFile('banned-permanent-ips.json', 'utf8', (err, data) => {
    if (err) return res.status(500).send('Hiba történt a lista olvasásakor.');

    let bannedList = JSON.parse(data);
    const index = bannedList.indexOf(targetIp);
    if (index > -1) {
      bannedList.splice(index, 1);  // IP törlés a fájlból
      permanentBannedIPs = permanentBannedIPs.filter(ip => ip !== targetIp);  // IP törlés a memóriából

      fs.writeFile('banned-permanent-ips.json', JSON.stringify(bannedList, null, 2), (err) => {
        if (err) return res.status(500).send('Hiba történt a lista frissítésekor.');
        res.send(`✅ IP ${targetIp} véglegesen feloldva lett.`);
        
        // Discord log küldése
        axios.post(ALERT_WEBHOOK, {
          username: "IP Feloldó",
          embeds: [{
            title: 'Végleges feloldás!',
            description: `**IP-cím:** ${targetIp}\n**Akció:** Végleges feloldás`,
            color: 0x00ff00
          }]
        }).catch(() => {});

        // Ha az IP feloldása megtörtént, akkor nyisd meg a "banned-permanent.html"-t
        const unbannedPage = path.join(__dirname, 'public', 'banned-permanent.html');
        if (fs.existsSync(unbannedPage)) {
          return res.status(200).sendFile(unbannedPage); // közvetlen fájl
        } else {
          return res.status(200).send('Az IP véglegesen feloldva lett.');
        }
      });
    } else {
      return res.status(404).send('❌ Ez az IP nincs a végleges tiltott listában.');
    }
  });
});

/* =========================
// Rossz kombináció figyelő
// ========================= */
app.post('/report', express.json(), async (req, res) => {
  const ip = getClientIp(req);
  const { reason, page } = req.body || {};

  // SAJÁT IP: ne logolja rossz kombinációnak és ne tiltsa
  if (MY_IPS.includes(ip)) {
    return res.json({ ok: true, ignored: true });
  }

  const geoData = await getGeo(ip);
  const count = recordBadAttempt(ip);

  // Discord log
  axios.post(ALERT_WEBHOOK, {
    username: "Kombináció figyelő",
    embeds: [{
      title: count >= MAX_BAD_ATTEMPTS ? 'IP TILTVA – túl sok rossz kombináció!' : `Rossz kombináció (${count}/${MAX_BAD_ATTEMPTS})`,
      description: `**IP:** ${ip}\n**Ok:** ${reason || 'Ismeretlen'}\n` + formatGeoDataReport(geoData, page),
      color: count >= MAX_BAD_ATTEMPTS ? 0xff0000 : 0xffa500
    }]
  }).catch(() => {});

  if (count >= MAX_BAD_ATTEMPTS && !WHITELISTED_IPS.includes(ip)) {
    banIp(ip);
    const bannedPage = path.join(__dirname, 'public', 'banned-ip.html');
    return fs.existsSync(bannedPage)
      ? res.status(403).sendFile(bannedPage) // közvetlen file – nincs redirect
      : res.status(403).send('Az IP címed ideiglenesen tiltva lett (24h). 🚫');
  }

  res.json({ ok: true });
});
    
/* =========================
// Statikus fájlok
// ========================= */
app.use(express.static(path.join(__dirname, 'public')));

/* =========================
// Főoldal: mindig szaby/index.html (URL-ben NINCS /szaby)
// ========================= */
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'szaby', 'index.html');
  return fs.existsSync(filePath) ? res.sendFile(filePath) : res.status(404).send('Főoldal nem található');
});

/* =========================
// 404
// ========================= */
app.use((req, res) => res.status(404).send('404 Not Found'));

app.listen(PORT, () => console.log(`Szerver elindult: http://localhost:${PORT}`));
