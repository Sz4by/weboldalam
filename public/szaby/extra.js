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

    // F12 (fejlesztői eszközök)
    if (e.key === 'F12') {
        e.preventDefault();
        reportBadActivity('F12 billentyű blokkolva');
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

// ======================================================================
// === ÚJ KÓDRÉSZ: Konzol megnyitásának érzékelése és átirányítás ===
// ======================================================================

(function() {
    const devtools = /./;
    devtools.toString = function() {
        // Amikor a konzol megnyílik és megpróbálja kiírni ezt az objektumot,
        // ez a funkció lefut, és elindítja az átirányítást.
        window.location.href = 'https://www.google.com'; // <-- IDE ÍRD BE A CÉL WEBOLDALT!
    };

    // Időnként kiírjuk a konzolra az objektumot.
    // Ha a konzol nyitva van, az megpróbálja feldolgozni és ezzel elindítja az átirányítást.
    setInterval(() => {
        console.log(devtools);
        console.clear(); // Kitöröljük a konzolt, hogy ne legyen feltűnő a logolás.
    }, 1000);
})();
