document.addEventListener('keydown', (e) => {
    // Ctrl+U (forrás megtekintés)
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        reportBadActivity('Ctrl+U kombináció blokkolva (forráskód megtekintés)');
    }

    // Ctrl+Shift+I (fejlesztői eszközök)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        reportBadActivity('Ctrl+Shift+I kombináció blokkolva (fejlesztői eszközök)');
    }

    // Ctrl+Shift+J (fejlesztői konzol)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        reportBadActivity('Ctrl+Shift+J kombináció blokkolva (fejlesztői konzol)');
    }

    // F12 (fejlesztői eszközök megnyitása)
    if (e.key === 'F12') {
        e.preventDefault();
        reportBadActivity('F12 gomb blokkolva (fejlesztői eszközök)');
    }

    // Ctrl+S (mentés)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        reportBadActivity('Ctrl+S kombináció blokkolva (oldal mentése)');
    }

    // Ctrl+P (nyomtatás)
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        reportBadActivity('Ctrl+P kombináció blokkolva (oldal nyomtatása)');
    }
});

document.addEventListener('contextmenu', (e) => {
    // Jobb kattintás letiltása
    e.preventDefault();
    reportBadActivity('Jobb kattintás blokkolva (kontextus menü)');
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

// ---------------- MÓDOSÍTOTT RÉSZ KEZDETE ----------------

// Ez a függvény ellenőrzi, hogy az eszköz asztali gép-e (nem telefon vagy tablet).
function isDesktop() {
    // A 768px egy gyakori töréspont a mobil/tablet és az asztali nézetek között.
    return window.innerWidth > 768;
}

// A DevTools figyelőt csak akkor futtatjuk, ha az eszköz asztali gépnek tűnik.
// Ezzel elkerüljük a felesleges átirányításokat mobil eszközökön.
if (isDesktop()) {
    setInterval(() => {
        const threshold = 160; // Pixelben megadott küszöbérték.
        
        // Ellenőrizzük a böngészőablak külső és belső méreteinek különbségét.
        if (
            window.outerWidth - window.innerWidth > threshold ||
            window.outerHeight - window.innerHeight > threshold
        ) {
            // Ha a DevTools nyitva van, átirányítunk.
            // Itt add meg ugyanazt a címet, mint a HTML-ben
            window.location.href = 'https://www.google.com/hibaoldal.html';
        }
    }, 1000); // Ellenőrzés másodpercenként.
}

// ---------------- MÓDOSÍTOTT RÉSZ VÉGE ----------------

