// EGYEDI KURZOR
const cursor = document.getElementById('custom-cursor');
document.addEventListener('mousemove', (e) => { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; });
document.addEventListener('mousedown', () => cursor.classList.add('clicking'));
document.addEventListener('mouseup', () => cursor.classList.remove('clicking'));
document.querySelectorAll('a, button, input').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
});

// BIZTONSÁG
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => { if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&(e.key==='I'||e.key==='J'))||(e.ctrlKey&&e.key==='u')) e.preventDefault(); });

// HÁTTÉR
const initSpace = () => {
    const container = document.getElementById('starfield-canvas');
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x050505, 0.002);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000); camera.position.z = 10;
    const renderer = new THREE.WebGLRenderer({alpha:true}); renderer.setSize(window.innerWidth, window.innerHeight); container.appendChild(renderer.domElement);
    const geo = new THREE.BufferGeometry(); const pos = [];
    for(let i=0; i<6000*3; i++) pos.push((Math.random()-0.5)*600);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({color:0xaaaaaa, size:0.7});
    const mesh = new THREE.Points(geo, mat); scene.add(mesh);
    function animate() {
        requestAnimationFrame(animate);
        const p = geo.attributes.position.array;
        for(let i=0; i<6000; i++) { p[3*i+2] += 2; if(p[3*i+2]>50) p[3*i+2] = -400; }
        geo.attributes.position.needsUpdate = true; mesh.rotation.z += 0.002; renderer.render(scene, camera);
    }
    animate();
    window.addEventListener('resize', ()=>{ camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
};

// IDŐ FORMÁZÓ
function formatTime(seconds) {
    if(isNaN(seconds)) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

// DISCORD & SPOTIFY LOGIKA
const DISCORD_ID = '1095731086513930260';
let discordHandle = "Szaby";
let gameStartTime = null;
let spotifyData = null;
let lastKnownActivityHTML = "";

// Ez a függvény csak a Discord/Spotify adatokat frissíti, a számlálót NEM!
async function updateData() {
    try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`);
        const json = await res.json();
        if(json.success) {
            const d = json.data;
            const u = d.discord_user;
            
            discordHandle = u.username + (u.discriminator!=='0'?'#'+u.discriminator:'');
            document.getElementById('d-name').innerText = u.global_name || u.username;
            document.getElementById('d-avatar').src = `https://cdn.discordapp.com/avatars/${DISCORD_ID}/${u.avatar}.png`;
            
            const statusColors = { online:'#22c55e', idle:'#eab308', dnd:'#ef4444', offline:'#6b7280' };
            document.getElementById('d-status-dot').style.backgroundColor = statusColors[d.discord_status] || '#6b7280';
            
            const customStatus = d.activities.find(a => a.type === 4);
            let customHTML = customStatus ? (customStatus.state || 'Online') : d.discord_status.toUpperCase();
            document.getElementById('d-custom-status').innerText = customHTML;

            // LISTA ÉPÍTÉSE
            let html = '';

            // 1. Játék
            const game = d.activities.find(a => a.type===0 || a.type===1);
            if(game) {
                if (!gameStartTime || (game.timestamps?.start && game.timestamps.start !== gameStartTime)) gameStartTime = game.timestamps?.start || null;
                let img = game.assets?.large_image ? (game.assets.large_image.startsWith("mp:") ? game.assets.large_image.replace(/mp:external\/([^\/]*)\/(https?)(:|\/)/, '$2:/') : `https://cdn.discordapp.com/app-assets/${game.application_id}/${game.assets.large_image}.png`) : 'https://placehold.co/50x50/000/fff?text=GAME';
                
                html += `
                <div class="activity-item game">
                    <img src="${img}" class="w-10 h-10 rounded bg-gray-800 object-cover">
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold text-white truncate">${game.name}</p>
                        <p class="text-[10px] text-[#00f3ff] truncate">${game.state||'Játékban'}</p>
                        <p id="game-timer-display" class="text-[10px] text-gray-400 font-mono mt-1">...</p>
                    </div>
                    <i class="fas fa-gamepad text-[#00f3ff]"></i>
                </div>`;
            } else { gameStartTime = null; }

            // 2. Spotify
            if(d.listening_to_spotify) {
                const s = d.spotify;
                spotifyData = s;
                html += `
                <div class="activity-item spotify" data-song-id="${s.track_id}">
                    <div class="flex items-center gap-3">
                        <img src="${s.album_art_url}" class="w-10 h-10 rounded bg-gray-800 object-cover">
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-bold text-white truncate">${s.song}</p>
                            <p class="text-[10px] text-[#1db954] truncate">${s.artist}</p>
                        </div>
                        <i class="fab fa-spotify text-[#1db954]"></i>
                    </div>
                    <div class="spotify-bar-container">
                        <div id="discord-spotify-bar" class="spotify-bar-fill"></div>
                    </div>
                    <div class="spotify-time-labels">
                        <span id="discord-spotify-curr">0:00</span>
                        <span id="discord-spotify-end">0:00</span>
                    </div>
                </div>`;
            } else { spotifyData = null; }

            if(html === '') html = `<div class="py-2 text-center text-xs text-gray-500 italic">Jelenleg inaktív...</div>`;

            // FRISSÍTÉS HA KELL
            let shouldUpdate = true;
            if(lastKnownActivityHTML === html) shouldUpdate = false;
            
            const existingSpotify = document.querySelector('.activity-item.spotify');
            if(existingSpotify && d.listening_to_spotify && existingSpotify.getAttribute('data-song-id') === d.spotify.track_id && lastKnownActivityHTML === html) {
                shouldUpdate = false;
            }

            if(shouldUpdate) {
                document.getElementById('activity-list').innerHTML = html;
                lastKnownActivityHTML = html;
            }
        }
    } catch(e) { console.log(e); }
}

// IDŐZÍTŐK
setInterval(() => {
    document.getElementById('local-clock').innerText = new Date().toLocaleTimeString('hu-HU');
    
    if(gameStartTime) {
        const diff = Math.floor((Date.now() - gameStartTime)/1000);
        const el = document.getElementById('game-timer-display');
        if(el) el.innerText = `${formatTime(diff)} ideje`;
    }

    if(spotifyData) {
        const start = spotifyData.timestamps.start;
        const end = spotifyData.timestamps.end;
        const now = Date.now();
        if(end > start) {
            const total = end - start;
            const current = now - start;
            const pct = Math.min((current/total)*100, 100);
            
            const bar = document.getElementById('discord-spotify-bar');
            const cEl = document.getElementById('discord-spotify-curr');
            const eEl = document.getElementById('discord-spotify-end');
            
            if(bar) bar.style.width = `${pct}%`;
            if(cEl) cEl.innerText = formatTime(current/1000);
            if(eEl) eEl.innerText = formatTime(total/1000);
        }
    }
}, 1000);

function copyDiscord() {
    navigator.clipboard.writeText(discordHandle).then(()=>alert("Discord név másolva!")).catch(()=>{});
}

// LEJÁTSZÓ
const playlist = [
    { title: "UP DOWN", artist: "Dyce", src: "https://miserable-amethyst-x87rkxzhll-6n49e2ulvg.edgeone.dev/SpotiDownloader.com%20-%20UP%20DOWN%20-%20Dyce%20(1).mp3" },
    { title: "Night Drift", artist: "SYSTEM", src: "https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/race2.ogg" },
    { title: "Ambient Core", artist: "LOFI", src: "https://commondatastorage.googleapis.com/codeskulptor-demos/pyman_assets/ateapill.ogg" }
];
let trackIdx=0; const audio=document.getElementById('bg-music');

function loadTrack(i) {
    const t = playlist[i]; audio.src = t.src;
    document.getElementById('track-title').innerText = t.title;
    document.getElementById('track-artist').innerText = t.artist;
}

document.getElementById('play-btn').addEventListener('click', ()=>{
    const btn = document.getElementById('play-btn');
    if(audio.paused) { audio.play(); btn.innerHTML='<i class="fas fa-pause"></i>'; }
    else { audio.pause(); btn.innerHTML='<i class="fas fa-play"></i>'; }
});

document.getElementById('next-btn').addEventListener('click', ()=>{ trackIdx=(trackIdx+1)%playlist.length; loadTrack(trackIdx); audio.play(); });
document.getElementById('prev-btn').addEventListener('click', ()=>{ trackIdx=(trackIdx-1+playlist.length)%playlist.length; loadTrack(trackIdx); audio.play(); });

audio.addEventListener('timeupdate', ()=>{
    if(audio.duration) {
        const pct = (audio.currentTime/audio.duration)*100;
        document.getElementById('music-bar').style.width = pct+'%';
        document.getElementById('current-time').innerText = formatTime(audio.currentTime);
        document.getElementById('total-time').innerText = formatTime(audio.duration);
    }
});

audio.volume=0.2;
document.getElementById('volume-slider').addEventListener('input', e=>audio.volume=e.target.value);

// --- ÚJ LÁTOGATÓ SZÁMLÁLÓ FUNKCIÓ ---
function countVisitor() {
    fetch('/api/counter')
        .then(r => r.json())
        .then(d => document.getElementById('visit-count').innerText = d.count)
        .catch(() => {});
}

window.onload = () => {
    initSpace(); updateData(); setInterval(updateData, 5000); loadTrack(0);
    
    // START GOMB: CSAK ITT ADJA HOZZÁ A LÁTOGATÓT!
    document.getElementById('start-btn').addEventListener('click', ()=>{
        const ol = document.getElementById('welcome-overlay'); ol.style.opacity='0';
        setTimeout(()=>ol.remove(), 500); 
        
        // --- ITT HÍVJUK MEG A SZÁMLÁLÓT ---
        countVisitor(); 
        
        audio.play().then(() => {
            // Ikon váltása 'pause'-ra
            document.getElementById('play-btn').innerHTML='<i class="fas fa-pause"></i>';
        });
    });
};

/* --- HÚZÁS (DRAG & DROP) TILTÁSA --- */
document.addEventListener('dragstart', function(event) {
    event.preventDefault();
    return false;
});
