import { COPY, NAV } from '../lib/labels';
import type { ViewName } from '../lib/route';

/* ===================================================================
   The chrome the three cover pages share.

   The landing page, the blueprint and the directory all render outside
   the shell — no masthead, no footer — because they are a cover rather
   than a reading surface. One bar across all three, reading the same
   NAV list the masthead reads, so a section cannot come to be called
   two things.
   =================================================================== */

export function CoverBar({ onGo }: { onGo: (view: ViewName) => void }) {
  return (
    <header className="cover-bar">
      <button type="button" className="cover-mark" onClick={() => onGo('home')}>
        {COPY.title}
      </button>
      <nav className="cover-nav" aria-label="Sections">
        {NAV.map((n) => (
          <button key={n.view} type="button" onClick={() => onGo(n.view)}>
            {n.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
