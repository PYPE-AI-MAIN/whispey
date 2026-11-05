// "Copy page" next to the title: copies the page as plain text (handy for
// pasting into an AI assistant), with a menu to open the page in Claude or ChatGPT.
import React, {useEffect, useRef, useState} from 'react';

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);
const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
);

/** The article as readable text: headings, paragraphs, lists and tables, without the page chrome. */
function pageText() {
  const article = document.querySelector('article .markdown');
  if (!article) return document.title;
  const clone = article.cloneNode(true);
  clone.querySelectorAll('.wp-page-actions, .hash-link, button').forEach((el) => el.remove());
  return `${clone.innerText.trim()}\n\nSource: ${window.location.href}`;
}

export default function PageActions() {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pageText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked: nothing to do, the page is still there to select
    }
    setOpen(false);
  };

  const askIn = (base) => {
    const prompt = `Read ${window.location.href} and help me with Whispey.`;
    window.open(`${base}${encodeURIComponent(prompt)}`, '_blank', 'noopener');
    setOpen(false);
  };

  return (
    <div className="wp-page-actions" ref={menuRef}>
      <button type="button" className="wp-page-actions-main" onClick={copy}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        <span>{copied ? 'Copied' : 'Copy page'}</span>
      </button>
      <button
        type="button"
        className="wp-page-actions-toggle"
        aria-label="More page actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronIcon />
      </button>
      {open && (
        <div className="wp-page-actions-menu" role="menu">
          <button type="button" role="menuitem" onClick={copy}>
            <strong>Copy page</strong>
            <span>Copy this page as text for an AI assistant</span>
          </button>
          <button type="button" role="menuitem" onClick={() => askIn('https://claude.ai/new?q=')}>
            <strong>Open in Claude</strong>
            <span>Ask questions about this page</span>
          </button>
          <button type="button" role="menuitem" onClick={() => askIn('https://chatgpt.com/?q=')}>
            <strong>Open in ChatGPT</strong>
            <span>Ask questions about this page</span>
          </button>
        </div>
      )}
    </div>
  );
}
