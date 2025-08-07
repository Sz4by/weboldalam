// Jobb kattintás tiltása és logolása
document.addEventListener('contextmenu', function(e) {
  e.preventDefault();
  fetch('/report', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      reason: 'Jobb kattintás',
      page: window.location.pathname
    })
  });
  alert('A jobb kattintás le van tiltva ezen az oldalon!');
});

// Ctrl+U, Ctrl+S, Ctrl+Shift+I tiltása és logolása
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey && (e.key === 'u' || e.key === 's' || e.key === 'U' || e.key === 'S')) ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
      (e.key === 'F12')) {
    e.preventDefault();
    let reason = '';
    if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) reason = 'Ctrl+U';
    else if (e.ctrlKey && (e.key === 's' || e.key === 'S')) reason = 'Ctrl+S';
    else if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) reason = 'Ctrl+Shift+I';
    else if (e.key === 'F12') reason = 'F12';
    else reason = 'Ismeretlen tiltott kombináció';

    fetch('/report', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        reason: `Tiltott kombináció: ${reason}`,
        page: window.location.pathname
      })
    });
    alert(`${reason} le van tiltva ezen az oldalon!`);
  }
});
