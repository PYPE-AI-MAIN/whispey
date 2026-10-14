// After a new deploy, a tab that was already open asks for page files that no
// longer exist ("Loading chunk … failed"). Reload once to pick up the new
// version instead of showing an error. The flag stops a reload loop if the
// files are genuinely unreachable.
const FLAG = 'wp-chunk-reload';

function isStaleChunk(error) {
  const text = `${error?.name ?? ''} ${error?.message ?? ''}`;
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk/i.test(text);
}

function reloadOnce() {
  try {
    if (sessionStorage.getItem(FLAG)) return;
    sessionStorage.setItem(FLAG, '1');
  } catch {
    // storage blocked: still reload once; the browser keeps us out of a tight loop
  }
  window.location.reload();
}

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (e) => {
    if (isStaleChunk(e.reason)) reloadOnce();
  });
  window.addEventListener('error', (e) => {
    if (isStaleChunk(e.error)) reloadOnce();
  });
  // a page that loaded fine clears the flag, so the next deploy can reload again
  window.addEventListener('load', () => {
    try {
      sessionStorage.removeItem(FLAG);
    } catch {
      // nothing to clear
    }
  });
}
