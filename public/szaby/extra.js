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