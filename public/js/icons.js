// Iconos lineales dibujados a mano (estilo Lucide). Sin emojis.
(function () {
  const svg = (inner, extra = '') =>
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${inner}</svg>`;
  window.ICONS = {
    check: svg('<path d="M4.5 12.5l5 5 10-11"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    volume: svg('<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 010 7"/><path d="M18.5 5.5a9 9 0 010 13"/>'),
    mute: svg('<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9l5 6M21 9l-5 6"/>'),
    maximize: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
    play: svg('<path d="M7 4.5v15l12-7.5z"/>'),
    replay: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/><path d="M10.5 9.2v5.6l4.5-2.8z"/>'),
    users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.2a6.5 6.5 0 013.5 5.8"/>'),
    arrowRight: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    arrowLeft: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
    scale: svg('<path d="M12 4v16M7 20h10M4 8h16"/><path d="M4 8l-2.5 6a3 3 0 005 0zM20 8l-2.5 6a3 3 0 005 0z"/>'),
    flask: svg('<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/><path d="M7.5 15h9"/>'),
    tv: svg('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  };
})();
