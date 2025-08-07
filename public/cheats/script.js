// Betöltéskor ellenőrizzük a mentett beállítást
window.onload = function() {
    // Ellenőrizzük, hogy van-e elmentett téma a localStorage-ban
    let savedTheme = localStorage.getItem("theme");

    // Ha van mentett téma, alkalmazzuk azt, ha nincs, akkor világos módot állítunk be alapértelmezettnek
    if (savedTheme) {
        document.body.setAttribute("data-theme", savedTheme);
    } else {
        document.body.setAttribute("data-theme", "light"); // Alapértelmezett: világos mód
    }

    // Fejléc azonnali megjelenítése
    document.querySelector('header').style.display = 'block'; // Fejléc azonnali megjelenítése
}

// Téma váltása
function toggleTheme() {
    // Az aktuális téma lekérése
    let currentTheme = document.body.getAttribute("data-theme");

    // Az új téma beállítása, ha sötét van, világosra váltunk, ha világos, sötétre
    let newTheme = currentTheme === "dark" ? "light" : "dark";

    // Az új téma alkalmazása a body elemre
    document.body.setAttribute("data-theme", newTheme);

    // Az új témát elmentjük a localStorage-ba, hogy megmaradjon a következő oldalbetöltéskor
    localStorage.setItem("theme", newTheme);
}

// Kulcs másolása
function copyKey(productId) {
    // Kulcs lekérése a megfelelő input mezőből
    var keyInput = document.getElementById(productId + 'Key');

    // Ha nincs input mező, akkor létrehozzuk
    if (!keyInput) {
        keyInput = document.createElement('input');
        keyInput.value = "PÉLDA-KULCS-" + Math.floor(Math.random() * 1000000); // Dinamikus kulcs generálása
        keyInput.id = productId + 'Key';
        keyInput.style.display = 'none'; // Rejtett input mező
        document.body.appendChild(keyInput); // Hozzáadjuk a rejtett inputot a body-hoz
    }

    // Kiválasztjuk a szöveget, hogy kimásolhassuk
    keyInput.select();
    keyInput.setSelectionRange(0, 99999); // Mobilokon is működjön

    // Használjuk a Clipboard API-t a másoláshoz
    navigator.clipboard.writeText(keyInput.value).then(function() {
        // Ha sikerült a másolás
        alert('A kulcs sikeresen kimásolva: ' + keyInput.value);
    }).catch(function(error) {
        // Ha valami hiba történik a másolás során
        alert('Hiba történt a kulcs másolásakor: ' + error);
    });
}
