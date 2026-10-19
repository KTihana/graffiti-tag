const styleId = 'graffiti-tag-input-focus';

export function installWebInputFocusStyle() {
  if (typeof document === 'undefined' || document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    input:focus, textarea:focus,
    [role="button"]:focus, [role="checkbox"]:focus,
    .leaflet-marker-icon:focus {
      outline: none !important;
    }
    [role="button"], [role="checkbox"], .leaflet-marker-icon {
      -webkit-tap-highlight-color: transparent;
    }
    /* Keyboard focus stays visible through a fill change, without a ring. */
    [role="button"]:focus-visible, [role="checkbox"]:focus-visible {
      filter: brightness(0.88);
    }
  `;
  document.head.appendChild(style);
}
