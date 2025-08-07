// ---- MODERN MUSIC PLAYER SCRIPT + Cover ----
const playlist = [
  { src: '/szaby/music/1.mp3', title: 'Első zene címe', cover: '/szaby/images/cover1.jpg' },
  { src: 'music/2.mp3', title: 'Második Chill', cover: 'images/cover2.jpg' },
  { src: 'music/3.mp3', title: 'Lazulás este', cover: 'images/cover3.jpg' },
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

// **Autoplay kezelés**
window.addEventListener('DOMContentLoaded', () => {
  loadSong(current);          // Zene betöltése (nem indítjuk automatikusan, csak lentebb)
  audio.muted = true;         // Némítva indítjuk
  audio.play().then(() => {
    // Ha sikerült elindítani, oké (de némítva van)
  }).catch(() => {
    // Ha nem sikerült elindítani (pl. blokkolva van), akkor első kattintásra indítjuk majd
    document.body.addEventListener('click', playFirst, { once: true });
  });
  // Első kattintásnál bekapcsoljuk a hangot
  function playFirst() {
    audio.muted = false;
    audio.play();
  }
});

// Ha valaki a play gombra kattint, mindig kapcsolja vissza a hangot
playBtn.onclick = function () {
  audio.muted = false;
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
  audio.muted = false;
};

nextBtn.onclick = function () {
  current = (current + 1) % playlist.length;
  loadSong(current, true);
  audio.muted = false;
};

audio.addEventListener('play', () => {
  playBtn.innerHTML = `<i class="fas fa-pause"></i>`;
  if (musicCover) musicCover.classList.add('playing');
});

audio.addEventListener('pause', () => {
  playBtn.innerHTML = `<i class="fas fa-play"></i>`;
  if (musicCover) musicCover.classList.remove('playing');
});

audio.addEventListener('ended', () => {
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
