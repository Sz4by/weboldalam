// Ne engedj jobb kattintást
document.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // Megakadályozza a jobb kattintás menüt
    reportBadActivity('Jobb kattintás blokkolva');
});

// Ne engedj Ctrl+U vagy Ctrl+Shift+I kombinációt
document.addEventListener('keydown', (e) => {
    // Ctrl+U (forrás megtekintés)
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        reportBadActivity('Ctrl+U kombináció blokkolva');
    }

    // Ctrl+Shift+I (fejlesztői eszközök)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        reportBadActivity('Ctrl+Shift+I kombináció blokkolva');
    }
});

// Rossz tevékenység logolása
function reportBadActivity(reason) {
    const page = window.location.pathname;
    const reportData = {
        reason: reason,
        page: page
    };

    // Küldd el a jelentést a szervernek (itt az API endpoint-ot hívhatod meg)
    fetch('/report', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Jelentés elküldve:', data);
    })
    .catch(error => {
        console.error('Hiba történt a jelentés küldésekor:', error);
    });
}

// Modal és zene lejátszása (Elfogadom gombra kattintás)
document.getElementById("acceptBtn").onclick = function() {
    document.getElementById("blockModal").style.display = "none"; // Modal eltüntetése
    document.getElementById("audio").play(); // Zene elindítása
};

// ---------------- ÚJ RÉSZ KEZDETE ----------------

// Fejlesztői eszközök (DevTools) figyelése és átirányítás
// Ez a rész másodpercenként ellenőrzi, hogy a böngésző ablakának külső és belső mérete
// között van-e jelentős különbség. Ha a konzol dokkolva van (jobb oldalon vagy alul),
// ez a különbség megnő, ami jelzi a DevTools megnyitását.

setInterval(() => {
    const threshold = 160; // Ez egy küszöbérték pixelben. Finomhangolható.
    
    // Ellenőrizzük a szélesség és magasság különbségét
    if (
      window.outerWidth - window.innerWidth > threshold ||
      window.outerHeight - window.innerHeight > threshold
    ) {
      // Ha a különbség nagyobb a küszöbértéknél, átirányítjuk a felhasználót.
      window.location.href = 'https://www.google.com'; // <-- IDE ÍRD AZ ÁTIRÁNYÍTÁSI CÍMET!
    }
}, 1000); // Az ellenőrzés 1000ms (1 másodperc) időközönként fut le.

// ---------------- ÚJ RÉSZ VÉGE ----------------
