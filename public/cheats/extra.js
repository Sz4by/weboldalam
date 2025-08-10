// Ne engedj jobb kattintást
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();  // Megakadályozza a jobb kattintás menüt
    reportBadActivity('Jobb kattintás blokkolva');
});

// Ne engedj Ctrl+U, Ctrl+Shift+I, F12 és egyéb kombinációkat
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

    // F12 (fejlesztői eszközök)
    if (e.key === 'F12') {
        e.preventDefault();
        reportBadActivity('F12 billentyű blokkolva');
    }

    // Ctrl+Shift+J (fejlesztői eszközök konzol)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        reportBadActivity('Ctrl+Shift+J kombináció blokkolva');
    }

    // Ctrl+Shift+K (másik fejlesztői konzol parancs)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        reportBadActivity('Ctrl+Shift+K kombináció blokkolva');
    }

    // Ctrl+Shift+M (munkamenet átváltás, DevTools)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        reportBadActivity('Ctrl+Shift+M kombináció blokkolva');
    }

    // Egyéb DevTools parancsok (Ctrl+Shift+L, Ctrl+Shift+S stb.)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['L', 'S', 'E'].includes(e.key)) {
        e.preventDefault();
        reportBadActivity(`Ctrl+Shift+${e.key} kombináció blokkolva`);
    }

    // Ne engedj semmilyen más fejlesztői kombinációt (pl. konzolok, debugger-ek)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'I' || e.key === 'J' || e.key === 'K' || e.key === 'M' || e.key === 'U')) {
        e.preventDefault();
        reportBadActivity('Fejlesztői eszközök blokkolva');
    }
});

// Ellenőrzi, hogy a DevTools kinyílt-e
let devtoolsOpen = false;
const devtoolsCheck = setInterval(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    if (width <= 800 || height <= 600) {  // Ha a méret csökken, akkor valószínűleg DevTools van nyitva
        if (!devtoolsOpen) {
            devtoolsOpen = true;
            window.location.href = 'https://www.example.com';  // Itt add meg az átirányítási URL-t
            reportBadActivity('DevTools nyitva');
        }
    } else {
        devtoolsOpen = false;
    }
}, 1000);

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
