const styleId = 'graffiti-tag-input-focus';

export function installWebInputFocusStyle() {
  if (typeof document === 'undefined' || document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = 'input:focus, textarea:focus { outline: none !important; }';
  document.head.appendChild(style);
}
