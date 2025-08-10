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
