// ==========================================
// === ALKALMAZÁS LOGIKA (JÁTÉKOK, MODAL) ===
// ==========================================

// Drag & Drop tiltás (ez nem kritikus biztonsági elem, maradhat itt)
document.addEventListener('dragstart', function(e) {
    e.preventDefault();
    return false;
});

const games = [
    { id: 'gta5-legacy', category: 'GTA5', title: 'GTA 5 Legacy', version: 'Christmas Nightly Build', image: 'https://img.gurugamer.com/resize/1200x-/photo_galleries/2024/09/25/yimmenu-shut-down-2-086d.png', videoUrl: 'https://drive.google.com/file/d/1UPqOA7MucdGjohP4kWSjelgeLWlR1Uch/preview', description: 'A klasszikus YimMenu ünnepi kiadása. Stabil működés és megbízható védelem a havas Los Santosban.', status: 'UNDETECTED', statusColor: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10', features: ['Protection', 'Lua Loader', 'Snow Mode'], links: { download: 'https://github.com/Mr-X-GTA/YimMenu/releases/download/nightly/YimMenu.dll', fsl: 'https://files.catbox.moe/mpkr24.rar', injector: 'https://files.catbox.moe/d321k2.zip' } },
    { id: 'gta5-enhanced', category: 'GTA5', title: 'GTA V Enhanced', version: 'v2.0 Winter Update', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSxpcTcoDKXRkQoTt67rqoRY5u2KpfPhjiY2BWpPbq_cg&s=10', videoUrl: 'https://drive.google.com/file/d/1E7VPEIJfq2H48BpGaWAqFGRtDr3SA_oW/preview', description: 'Felturbózott élmény. Mostantól extra karácsonyi járművekkel és ajándék spawnolással.', status: 'UNDETECTED', statusColor: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10', features: ['Visual FX', 'Vehicle Mods', 'Gift Spawner'], links: { download: 'https://github.com/CSY0N/YimMenuVersion2/releases/download/YimMenuV2/Yimura.Menu.Enhanced.dll', fsl: 'https://files.catbox.moe/mpkr24.rar', injector: 'https://files.catbox.moe/d321k2.zip' } },
    { id: 'rdr2-terminus', category: 'RDR2', title: 'RDR2 Terminus', version: 'North Pole Edition', image: 'https://i.imgur.com/lrsUG1D.png', videoUrl: 'https://drive.google.com/file/d/169ONbZdq3b2sLy9dyjCGzu-LL3PBYdxj/preview', description: 'A vadnyugat téli arca. Végtelen lőszer, arany spawnolás és repülő szán mód.', status: 'UNDETECTED', statusColor: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10', features: ['Gold Spawner', 'No Clip', 'God Mode'], links: { download: 'https://files.catbox.moe/ynhjuu.zip', fsl: null, injector: null } }
];

// Inicializálás
document.addEventListener("DOMContentLoaded", function() {
    // Évszám frissítés
    const yearEl = document.getElementById('year');
    if(yearEl) yearEl.textContent = new Date().getFullYear();
    
    // Ikonok és játékok renderelése
    if(typeof lucide !== 'undefined') lucide.createIcons();
    renderGames('ALL');
});

// Figyelmeztető bezárása
function closeWarning() {
    document.getElementById('warningPopup').style.display = 'none';
}

// Játékok renderelése
function renderGames(cat) {
    const grid = document.getElementById('gamesGrid');
    if(!grid) return;
    
    grid.innerHTML = '';
    const filtered = cat === 'ALL' ? games : games.filter(g => g.category === cat);
    
    filtered.forEach((game, idx) => {
        const card = document.createElement('div');
        card.className = 'glass-card rounded-2xl overflow-hidden cursor-pointer group fade-in-up';
        card.style.animationDelay = idx * 0.1 + 's';
        card.onclick = () => openModal(game.id);
        
        let feats = game.features.map(f => `<span class="text-[10px] font-bold px-2 py-1 rounded bg-white/5 text-gray-300 border border-white/5 flex items-center gap-1"><i data-lucide="check" class="w-3 h-3 text-emerald-500"></i> ${f}</span>`).join('');
        
        card.innerHTML = `
            <div class="relative h-52 overflow-hidden">
                <div class="absolute inset-0 bg-black/40 z-10 group-hover:bg-black/20 transition-colors"></div>
                <img src="${game.image}" class="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700">
                <div class="absolute top-3 left-3 z-20"><span class="px-2 py-1 text-[10px] font-bold uppercase rounded border backdrop-blur-md ${game.statusColor}">${game.status}</span></div>
                <div class="absolute inset-0 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity"><div class="w-12 h-12 bg-white/10 backdrop-blur rounded-full flex items-center justify-center border border-white/20"><i data-lucide="play" class="w-5 h-5 text-white ml-1"></i></div></div>
            </div>
            <div class="p-5"><h3 class="text-xl font-bold text-white mb-1 group-hover:text-sky-400 transition-colors font-heading">${game.title}</h3><p class="text-xs text-gray-500 font-mono mb-4">${game.version}</p><div class="flex flex-wrap gap-2 mb-4">${feats}</div></div>
        `;
        grid.appendChild(card);
    });
    
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// Szűrés funkció
function filterGames(cat, btn) {
    document.querySelectorAll('.category-btn').forEach(b => {
        b.className = 'category-btn px-5 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-all';
    });
    btn.className = 'category-btn active px-5 py-2 rounded-lg text-sm font-bold bg-white/10 text-white shadow-sm transition-all';
    renderGames(cat);
}

// Modal megnyitása
function openModal(id) {
    const g = games.find(x => x.id === id);
    if(!g) return;
    
    document.getElementById('modalTitle').textContent = g.title;
    document.getElementById('modalVersion').textContent = g.version;
    document.getElementById('modalDescription').textContent = g.description;
    document.getElementById('modalVideo').src = g.videoUrl;
    
    const badge = document.getElementById('modalStatus');
    badge.textContent = g.status;
    badge.className = `text-[10px] font-bold uppercase tracking-wider mb-2 block ${g.statusColor.split(' ')[0]}`;
    
    const btnDl = document.getElementById('btnDownload');
    const extra = document.getElementById('extraButtons');
    
    btnDl.onclick = (e) => dl(e, g.links.download, g.id + '.dll');
    
    if(g.links.fsl || g.links.injector) {
        extra.classList.remove('hidden');
        document.getElementById('btnFsl').onclick = (e) => dl(e, g.links.fsl, 'fsl.rar');
        document.getElementById('btnInjector').onclick = (e) => dl(e, g.links.injector, 'injector.zip');
        document.getElementById('btnFsl').style.display = g.links.fsl ? 'flex' : 'none';
        document.getElementById('btnInjector').style.display = g.links.injector ? 'flex' : 'none';
    } else { extra.classList.add('hidden'); }
    
    document.getElementById('downloadModal').style.display = 'flex';
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// Modal bezárása
function closeModal() {
    document.getElementById('downloadModal').style.display = 'none';
    document.getElementById('modalVideo').src = "";
}

// Letöltés helper
function dl(e, url, name) {
    e.preventDefault();
    if(!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}