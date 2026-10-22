// "/" (and Cmd/Ctrl+K) jumps to the search box, unless you are already typing.
function isTyping(target) {
  if (!target) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function onKey(e) {
  const slash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey;
  const cmdK = e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey);
  if (!slash && !cmdK) return;
  if (slash && isTyping(e.target)) return;
  const input = document.querySelector('.navbar__search-input');
  if (!input) return;
  e.preventDefault();
  input.focus();
  input.select();
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKey);
}
