// ---- Hóesés ----
let snowCanvas = document.getElementById('snow');
let sctx = snowCanvas.getContext('2d');
let snowflakes = [];
function resizeSnow() {
  snowCanvas.width = window.innerWidth;
  snowCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeSnow);
resizeSnow();
function snow() {
  sctx.clearRect(0, 0, snowCanvas.width, snowCanvas.height);
  if (snowflakes.length < 100)
    snowflakes.push({
      x: Math.random() * snowCanvas.width,
      y: -10,
      r: Math.random() * 2 + 1,
      s: Math.random() * 1.3 + 0.7,
    });
  for (let f of snowflakes) {
    sctx.beginPath();
    sctx.arc(f.x, f.y, f.r, 0, 2 * Math.PI);
    sctx.fillStyle = '#fff9';
    sctx.fill();
    f.y += f.s;
    f.x += Math.sin(f.y / 12) * 0.7;
  }
  snowflakes = snowflakes.filter((f) => f.y < snowCanvas.height + 10);
  requestAnimationFrame(snow);
}
snow();

// ---- MODERN MUSIC PLAYER SCRIPT + Cover ----
const playlist = [
  { src: '/szaby/music/1.mp3', title: 'Lottery (Renegade)K CAMP', cover: '/szaby/images/cover1.jpg' },
  { src: '/szaby/music/2.mp3', title: 'Under The Influence (Body Language)Chris Brown', cover: '/szaby/images/cover2.jpg' },
];
let current = 0;
const audio = document.getElementById('audio');
const musicTitle = document.getElementById('musicTitle');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const progressBar = document.getElementById('progressBar');
const progress = document.getElementById('progress');
const currentTime = document.getElementById('currentTime');
const duration = document.getElementById('duration');
const musicCover = document.getElementById('musicCover');

// Kezdeti hangerő beállítása, ha a zene elindul
audio.volume = 0.2; // 20% hangerő

// Várj, amíg az oldal teljesen betöltődik
document.addEventListener('DOMContentLoaded', () => {
    // Modal megjelenítése az oldal betöltődése után
    document.getElementById("blockModal").style.display = "flex"; // Modal megjelenítése

    // Elfogadom gombra kattintás
    document.getElementById("acceptBtn").onclick = function() {
        document.getElementById("blockModal").style.display = "none"; // Modal eltüntetése
        document.getElementById("audio").play(); // Zene elindítása
    };
});

// Kezdeti hangerő beállítása
const volumeBtn = document.getElementById('volumeBtn'); // Hangerő gomb
const volumeSliderWrap = document.getElementById('volumeSliderWrap'); // Hangerő csúszka
const volumeSlider = document.getElementById('volumeSlider'); // Csúszka értéke

// Kezdeti hangerő beállítása
audio.volume = 0.2;  // 20%-ra állítja a hangerőt
volumeSlider.value = 0.2;  // A csúszka értéke is 20%-ra van állítva

// Hangerő szabályozó megjelenítése
volumeBtn.addEventListener('click', () => {
    volumeSliderWrap.classList.toggle('active'); // Az active osztály hozzáadása a csúszkához
});

// Hangerő beállítása a csúszka értéke alapján
volumeSlider.addEventListener('input', () => {
    audio.volume = volumeSlider.value;
});

function loadSong(idx, autoPlay = false) {
  audio.src = playlist[idx].src;
  musicTitle.textContent = playlist[idx].title;
  if (musicCover) {
    musicCover.src = playlist[idx].cover || 'images/default_cover.jpg';
    musicCover.classList.remove('playing'); // Az osztályt is hozzáadjuk a borítóképhez
  }
  playBtn.innerHTML = `<i class="fas fa-play"></i>`;
  if (autoPlay) audio.play();
}

// Zene betöltése de nem indul el automatikusan
window.addEventListener('load', () => {
  loadSong(current, false); // false = ne induljon automatikusan
  audio.muted = false;      // ne legyen néma alapból
});

// Ha véget ér a zene
audio.addEventListener('ended', () => {
  if (musicCover) musicCover.classList.remove('playing');

  if (current < playlist.length - 1) {
    // Ha van következő zene, folytatjuk azzal
    current++;
    loadSong(current, true);
  } else {
    // Ha nincs több zene, újraindítjuk az elsőt
    current = 0;
    loadSong(current, true);
  }
});

playBtn.onclick = function () {
  if (audio.paused) {
    audio.play();
    playBtn.innerHTML = `<i class="fas fa-pause"></i>`;
  } else {
    audio.pause();
    playBtn.innerHTML = `<i class="fas fa-play"></i>`;
  }
};

prevBtn.onclick = function () {
  current = (current - 1 + playlist.length) % playlist.length;
  loadSong(current, true);
};

nextBtn.onclick = function () {
  current = (current + 1) % playlist.length;
  loadSong(current, true);
};

audio.addEventListener('play', () => {
  playBtn.innerHTML = `<i class="fas fa-pause"></i>`;
  if (musicCover) musicCover.classList.add('playing');
});

audio.addEventListener('pause', () => {
  playBtn.innerHTML = `<i class="fas fa-play"></i>`;
  if (musicCover) musicCover.classList.remove('playing');
});

function formatTime(sec) {
  sec = Math.floor(sec);
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
}

audio.addEventListener('timeupdate', () => {
  currentTime.textContent = formatTime(audio.currentTime);
  progress.style.width = ((audio.currentTime / audio.duration) * 100 || 0) + '%';
});

audio.addEventListener('loadedmetadata', () => {
  duration.textContent = '-' + formatTime(audio.duration);
});

progressBar.onclick = function (e) {
  const rect = progressBar.getBoundingClientRect();
  const pos = (e.clientX - rect.left) / rect.width;
  audio.currentTime = pos * audio.duration;
};
loadSong(current);

// ---- DISCORD STATUS FROM RENDER API ----
async function fetchDiscordStatus() {
  try {
    const response = await fetch('https://antilink.onrender.com/api/status');
    const data = await response.json();
    updateDiscordStatus(data);
  } catch (error) {
    console.error('Fetch Discord status failed', error);
    document.getElementById('discordUsername').textContent = 'Ismeretlen felhasználó';
    document.getElementById('discordStatusText').textContent = 'Státusz nem elérhető';
    const stateElem = document.getElementById('discordState');
    stateElem.textContent = 'Offline';
    stateElem.className = 'discord-status-state offline';
    document.getElementById('discordAvatar').src = 'images/discord.png';
  }
}

function updateDiscordStatus(data) {
  if (!data || !data.userData) {
    document.getElementById('discordUsername').textContent = 'Ismeretlen felhasználó';
    document.getElementById('discordStatusText').textContent = 'Státusz nem elérhető';
    const stateElem = document.getElementById('discordState');
    stateElem.textContent = 'Offline';
    stateElem.className = 'discord-status-state offline';
    document.getElementById('discordAvatar').src = 'images/discord.png';
    return;
  }

  const { user, displayName, activities } = data.userData;
  const discord_status = data.status;
  const userId = user?.id || '1095731086513930260';

  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png`
    : 'images/discord.png';

  document.getElementById('discordAvatar').src = avatarUrl;
  document.getElementById('discordUsername').textContent = displayName
    ? displayName
    : `${user?.username || 'Ismeretlen'}#${user?.discriminator || '0000'}`;

  const statusMap = {
    online: 'Online',
    dnd: 'Ne zavarjanak',
    idle: 'Tétlen',
    offline: 'Offline',
  };
  let statusText = statusMap[discord_status] || 'Ismeretlen státusz';

  if (activities && activities.length > 0) {
    const customStatus = activities.find(a => a.type === 4);
    if (customStatus && customStatus.state) {
      statusText = customStatus.state;
    }
  }

  const statusElem = document.getElementById('discordStatusText');
  const stateElem = document.getElementById('discordState');

  statusElem.textContent = statusText;
  stateElem.textContent = statusMap[discord_status] || 'Ismeretlen státusz';
  stateElem.className = `discord-status-state ${discord_status}`;
}

// Frissítés 15 másodpercenként
setInterval(fetchDiscordStatus, 15000);
fetchDiscordStatus();
