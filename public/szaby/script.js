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
  { src: '/szaby/music/2.mp3', title: 'Under The Influence (Body Language)', cover: '/szaby/images/cover2.jpg' },
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

audio.volume = 0.2;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("blockModal").style.display = "flex";

    document.getElementById("acceptBtn").onclick = function() {
        document.getElementById("blockModal").style.display = "none";
        document.getElementById("audio").play();
    };
});

const volumeBtn = document.getElementById('volumeBtn');
const volumeSliderWrap = document.getElementById('volumeSliderWrap');
const volumeSlider = document.getElementById('volumeSlider');

audio.volume = 0.2;
volumeSlider.value = 0.2;

volumeBtn.addEventListener('click', () => {
    volumeSliderWrap.classList.toggle('active');
});

volumeSlider.addEventListener('input', () => {
    audio.volume = volumeSlider.value;
});

function loadSong(idx, autoPlay = false) {
  audio.src = playlist[idx].src;
  musicTitle.textContent = playlist[idx].title;
  if (musicCover) {
    musicCover.src = playlist[idx].cover || 'images/default_cover.jpg';
    musicCover.classList.remove('playing');
  }
  playBtn.innerHTML = `<i class="fas fa-play"></i>`;
  if (autoPlay) audio.play();
}

window.addEventListener('load', () => {
  loadSong(current, false);
  audio.muted = false;
});

audio.addEventListener('ended', () => {
  if (musicCover) musicCover.classList.remove('playing');
  current = (current + 1) % playlist.length;
  loadSong(current, true);
});

playBtn.onclick = function () {
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
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
    const response = await fetch('https://test-status-1.onrender.com/status');
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

setInterval(fetchDiscordStatus, 15000);
fetchDiscordStatus();


// === LÁTOGATÓSZÁMLÁLÓ MŰKÖDÉSE ===
document.addEventListener("DOMContentLoaded", function() {
    
    const namespace = 'szaby-is-a-dev';  
    const key = 'latogatok';

    async function updateCounter() {
      try {
        const response = await fetch(`https://api.counterapi.dev/v1/${namespace}/${key}/up`);
        const data = await response.json();
        
        const countElement = document.getElementById('view-count-number');
        countElement.innerText = data.count;

      } catch (error) {
        console.error("Számláló hiba:", error);
        const countElement = document.getElementById('view-count-number');
        countElement.innerText = '–';
      }
    }
    updateCounter();
});


// === ÚJ, OPTIMALIZÁLT RÉSZ: EGYEDI EGÉRMUTATÓ MOZGATÁSA ===
document.addEventListener("DOMContentLoaded", function() {
  const cursor = document.querySelector('.custom-cursor');

  if (cursor) {
    // A kurzor pozíciójának frissítése a hatékonyabb 'transform' segítségével
    window.addEventListener('mousemove', e => {
      // A CSS-ben lévő 'scale' értéket is figyelembe kell vennünk,
      // ezért a transformot itt állítjuk össze teljesen.
      const isHovering = cursor.classList.contains('hover-effect');
      const scale = isHovering ? 'scale(0.7)' : 'scale(1)';
      
      // Beállítjuk a transzformációt az egér X és Y koordinátái, és a méretezés alapján
      cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px) ${scale}`;
    });

    // Kezeljük, ha az egér elhagyja vagy belép az ablakba
    document.addEventListener('mouseleave', () => {
        cursor.style.display = 'none';
    });
    document.addEventListener('mouseenter', () => {
        cursor.style.display = 'block';
    });
    
    // Kezeljük a hover effektust a linkeken és gombokon
    const interactiveElements = document.querySelectorAll('a, button, .progress-bar, .player-btn, .bio-link');
    interactiveElements.forEach(el => {
        el.addEventListener('mouseover', () => cursor.classList.add('hover-effect'));
        el.addEventListener('mouseout', () => cursor.classList.remove('hover-effect'));
    });
  }
});
