<script>
    // Blokkolja a jobb kattintást
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();  // Megakadályozza a jobb kattintást
        alert("A jobb kattintás le van tiltva ezen az oldalon.");
    });

    // Blokkolja a Ctrl+S, Ctrl+U és más fejlesztői eszközökhöz kapcsolódó billentyűparancsokat
    document.addEventListener('keydown', function(e) {
        // Ctrl+S (mentés) és Ctrl+U (forráskód megtekintése)
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) {
            e.preventDefault(); // Megakadályozza a billentyűparancsokat
            alert("Ez a billentyűparancs le van tiltva.");
        }
        
        // DevTools megnyitás blokkolása (F12, Ctrl+Shift+I, Ctrl+Shift+J)
        if ((e.key === 'F12') || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J'))) {
            e.preventDefault(); // Megakadályozza a DevTools megnyitást
            alert("A fejlesztői eszközök megnyitása le van tiltva.");
        }
    });

    // Blokkolja a fejlesztői eszközök hozzáférését, ha a felhasználó az F12 billentyűt nyomja
    (function() {
        let devtoolsOpen = false;
        const threshold = 160;
        const checkDevTools = () => {
            const widthThreshold = window.outerWidth - window.innerWidth > threshold;
            const heightThreshold = window.outerHeight - window.innerHeight > threshold;
            if (widthThreshold || heightThreshold) {
                devtoolsOpen = true;
                alert("A fejlesztői eszközök megnyitása le van tiltva.");
                return true;
            }
            return false;
        };
        setInterval(checkDevTools, 1000);
    })();
</script>

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
