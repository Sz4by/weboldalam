// Funkció, amely ellenőrzi, hogy mobil eszközt használunk-e
function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent);
}

// Ha mobil eszközt használunk
if (isMobileDevice()) {
    let devtoolsOpen = false;
    const devtoolsCheck = setInterval(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Mobil eszközön figyeljük a képernyő méretének változását
        if (width <= 800 && height <= 600 && !devtoolsOpen) {  // Ha a képernyő szélessége és magassága csökken
            devtoolsOpen = true;
            window.location.href = 'https://www.example.com';  // Itt add meg az átirányítást
            console.log("DevTools nyitva mobil eszközön");
        } else if (width > 800 || height > 600) {  // Ha a méret visszaáll, akkor a DevTools valószínűleg zárva van
            devtoolsOpen = false;
        }
    }, 1000); // Ellenőrzés 1 másodpercenként
} else {
    // Asztali eszközökön érzékeljük a DevTools-t
    let devtoolsOpen = false;
    const devtoolsCheck = setInterval(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        if (width <= 800 || height <= 600) {  // Ha a képernyő mérete csökken, akkor valószínűleg DevTools van nyitva
            if (!devtoolsOpen) {
                devtoolsOpen = true;
                window.location.href = 'https://www.example.com';  // Itt add meg az átirányítást
                console.log('DevTools nyitva');
            }
        } else {
            devtoolsOpen = false;
        }
    }, 1000);
}

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
