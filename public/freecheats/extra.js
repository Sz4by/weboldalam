// Ne engedj jobb kattintást
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();  // Megakadályozza a jobb kattintás menüt
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

    // F12 (Fejlesztői eszközök, másik lehetőség)
    if (e.key === 'F12') {
        e.preventDefault();
        reportBadActivity('F12 (fejlesztői eszközök) blokkolva');
    }

    // Ctrl+Shift+J (JavaScript konzol megnyitása)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        reportBadActivity('Ctrl+Shift+J kombináció blokkolva');
    }

    // Ctrl+Shift+C (Elemek vizsgálata)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        reportBadActivity('Ctrl+Shift+C kombináció blokkolva');
    }

    // Ctrl+P (Nyomtatás)
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        reportBadActivity('Ctrl+P kombináció blokkolva');
    }

    // Ctrl+S (Mentés)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        reportBadActivity('Ctrl+S kombináció blokkolva');
    }

    // Ctrl+Shift+N (Új inkognitó ablak)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        reportBadActivity('Ctrl+Shift+N kombináció blokkolva');
    }
});

// Funckió a DevTools nyitva állapotának ellenőrzésére
function detectDevTools() {
    const threshold = 160;  // Küszöb a DevTools észlelésére
    const width = window.outerWidth;
    const height = window.outerHeight;

    // Ha a DevTools nyitva van, akkor az ablak mérete megváltozik
    if (width - window.innerWidth > threshold || height - window.innerHeight > threshold) {
        // Lekérjük a felhasználó IP-jét a szerverről
        fetch('/check-ip')
            .then(response => response.json())
            .then(data => {
                // Ha az IP a whitelist-en van
                if (data.canRedirect) {
                    reportBadActivity('Fejlesztői eszközök megnyitása észlelve');
                    // Átirányítás egy másik oldalra
                    window.location.href = "https://www.gayporno.fm";  // Itt add meg a kívánt URL-t
                }
            })
            .catch(error => {
                console.error('Hiba történt az IP lekérésekor:', error);
            });
    }
}

// Ellenőrzés folyamatosan
setInterval(detectDevTools, 1000); // Minden másodpercben ellenőrzi

// Rossz tevékenység logolása
function reportBadActivity(reason) {
    const page = window.location.pathname;
    const reportData = {
        reason: reason,
        page: page
    };

    // Küldd el a jelentést a szervernek (itt az API endpoint-ot hívhatod meg)
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



