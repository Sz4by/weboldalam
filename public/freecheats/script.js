// MODÁL NYITÁSA
function openModal(game, downloadLink, fslLink, injectorLink, imageUrl) {
  const titleEl = document.getElementById('modalTitle');
  const dlEl = document.getElementById('modalDownloadLink');
  const fslEl = document.getElementById('modalFslLink');
  const injectorEl = document.getElementById('modalInjectorLink');
  const imageEl = document.getElementById('modalImage');
  const bd = document.getElementById('backdrop');
  const descriptionEl = document.getElementById('modalDescription');

  if (!titleEl || !dlEl || !fslEl || !bd || !imageEl || !injectorEl || !descriptionEl) {
    console.warn('Modal elemek nem találhatók.');
    return;
  }

  // Játék neve és kép beállítása
  titleEl.textContent = `${game} Csalás Letöltése`;
  imageEl.src = imageUrl || '';

  // Játék specifikus szöveg és szín beállítása
  switch (game) {
    case 'GTA 5 Legacy':
      descriptionEl.innerHTML = `
        A csalás kódok letöltéséhez kattints a gombra!<br>
        <strong>Figyelem:</strong> Ez a csalás jelenleg észlelve van a játékban, ezért ideiglenesen eltávolítottuk. Kérjük, légy türelmes!
      `;
      descriptionEl.style.backgroundColor = '#F54927';

      // Elrejti a letöltési gombokat
      dlEl.style.display = 'none';
      fslEl.style.display = 'none';
      injectorEl.style.display = 'none';
      break;
    case 'GTA V Enhanced':
      descriptionEl.innerHTML = `
        A csalás kódok letöltéséhez kattints a gombra!<br>
        <strong>Figyelem:</strong> Ez a csalás nem észlelhető a játékban, így biztonságosan használható.
      `;
      descriptionEl.style.backgroundColor = '#4BD2C0'; // Kék/zöld szín

      // Megjeleníti a letöltési gombokat
      dlEl.style.display = 'block';
      fslEl.style.display = 'block';
      injectorEl.style.display = 'block';
      break;
    case 'Red Dead Redemption 2 Terminus':
      descriptionEl.innerHTML = `
        A csalás kódok letöltéséhez kattints a gombra!<br>
        <strong>Figyelem:</strong> A csalások gyorsan hatnak a játékra, használat előtt teszteld őket.
      `;
      descriptionEl.style.backgroundColor = '#4BD2C0';

      // Megjeleníti a letöltési gombokat
      dlEl.style.display = 'block';
      fslEl.style.display = 'none';
      injectorEl.style.display = 'none';
      break;
    default:
      descriptionEl.innerHTML = `
        A csalás kódok letöltéséhez kattints a gombra!<br>
        <strong>Figyelem:</strong> Az egyéb csalások biztonságosak.
      `;
      descriptionEl.style.backgroundColor = '#7C5CFF';

      // Megjeleníti a letöltési gombokat
      dlEl.style.display = 'block';
      fslEl.style.display = 'block';
      injectorEl.style.display = 'block';
      break;
  }

  // Megjelenítjük a modált
  bd.style.display = 'flex';
  bd.setAttribute('aria-hidden', 'false');

  // Beállítjuk a linkeket
  dlEl.href = downloadLink || '#';
  fslEl.href = fslLink || '#';
  injectorEl.href = injectorLink || '#';

  // Letöltési gombok működése
  dlEl.addEventListener('click', function (e) {
    e.preventDefault();
    const link = document.createElement('a');
    link.href = downloadLink;
    link.download = downloadLink.split('/').pop();
    link.click();
  });

  fslEl.addEventListener('click', function (e) {
    e.preventDefault();
    const link = document.createElement('a');
    link.href = fslLink || downloadLink;
    link.download = fslLink.split('/').pop();
    link.click();
  });

  injectorEl.addEventListener('click', function (e) {
    e.preventDefault();
    const link = document.createElement('a');
    link.href = injectorLink || '#';
    link.click();
  });
}

// MODÁL ZÁRÁSA
document.getElementById('closeBtn').addEventListener('click', closeModal);
document.getElementById('backdrop').addEventListener('click', (e) => {
  if (e.target === document.getElementById('backdrop')) closeModal(); // Ha a háttérre kattintunk
});

function closeModal() {
  const bd = document.getElementById('backdrop');
  const modalImage = document.getElementById('modalImage');

  bd.style.display = 'none';
  bd.setAttribute('aria-hidden', 'true');

  // Leállítjuk a videót, amikor bezárul a modál
  modalImage.src = ""; // Üresre állítjuk
}
// Az értesítő megjelenítése, amikor az oldal betöltődik
window.onload = function () {
  const popup = document.getElementById('popup');
  const acceptBtn = document.getElementById('acceptBtn');

  // Popup megjelenítése
  popup.style.display = 'flex';

  // Ha a felhasználó rákattint az "Elfogadom" gombra
  acceptBtn.addEventListener('click', function () {
    popup.style.display = 'none'; // Popup eltűnik
  });
};