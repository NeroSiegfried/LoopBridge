import { useState, useEffect, useMemo, useRef } from 'react';
import SEO from '../components/SEO';
import { miscApi } from '../api';
import '../styles/glossary.css';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function groupByLetter(terms) {
  const groups = {};
  terms.forEach((t) => {
    const letter = (t.term[0] || '#').toUpperCase();
    (groups[letter] = groups[letter] || []).push(t);
  });
  return Object.keys(groups)
    .sort()
    .map((letter) => ({ letter, terms: groups[letter] }));
}

export default function Glossary() {
  const [terms, setTerms] = useState([]);
  const [query, setQuery] = useState('');
  const [activeLetter, setActiveLetter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const entryRefs = useRef({});

  useEffect(() => {
    let active = true;
    miscApi
      .glossary()
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : data.terms || [];
        setTerms([...list].sort((a, b) => a.term.localeCompare(b.term)));
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const available = useMemo(
    () => new Set(terms.map((t) => (t.term[0] || '').toUpperCase())),
    [terms]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = terms;
    if (q) {
      list = list.filter(
        (t) =>
          t.term.toLowerCase().includes(q) ||
          t.definition.toLowerCase().includes(q)
      );
    }
    if (activeLetter) {
      list = list.filter((t) => (t.term[0] || '').toUpperCase() === activeLetter);
    }
    return list;
  }, [terms, query, activeLetter]);

  const groups = useMemo(() => groupByLetter(filtered), [filtered]);

  const onSearch = (value) => {
    setQuery(value);
    if (value) setActiveLetter(null);
  };

  const onLetter = (letter) => {
    setActiveLetter((prev) => (prev === letter ? null : letter));
    setQuery('');
  };

  const jumpTo = (id) => {
    const el = entryRefs.current[id];
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  const searchField = (idSuffix) => (
    <div className="glossary-search">
      <i className="fa-solid fa-magnifying-glass glossary-search-icon" />
      <input
        id={`glossary-search-${idSuffix}`}
        type="text"
        value={query}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search for a word.."
        aria-label="Search the glossary"
        autoComplete="off"
      />
      {query && (
        <button
          className="glossary-search-clear"
          onClick={() => onSearch('')}
          aria-label="Clear search"
        >
          <i className="fa-solid fa-xmark" />
        </button>
      )}
    </div>
  );

  return (
    <>
      <SEO
        title="Glossary — LoopBridge"
        description="A concise A–Z reference for the language of Web3 and New Finance — crypto, blockchain, and trading terms explained in plain language."
      />

      <header className="glossary-hero">
        <div className="section-container">
          <div className="glossary-hero-text">
            <h1>Understanding the Language of Web3 and New Finance</h1>
            <p>
              A concise reference designed to help you understand the language of
              New Finance and move forward with clarity.
            </p>
          </div>
          <div className="glossary-hero-img">
            <img src="/images/glossary-illustration.png" alt="A–Z crypto glossary" />
          </div>
        </div>
      </header>

      <section className="glossary-section">
        <div className="section-container">
          <div className="glossary-layout">
            <aside className="glossary-sidebar">
              {/* Desktop: search above the A–Z term index */}
              {searchField('desktop')}

              {/* Mobile: 26-letter filter card with search inside */}
              <div className="glossary-letterbox">
                <div className="glossary-letters" role="group" aria-label="Filter by letter">
                  {ALPHABET.map((letter) => (
                    <button
                      key={letter}
                      className={`glossary-letter${activeLetter === letter ? ' active' : ''}`}
                      disabled={!available.has(letter)}
                      onClick={() => onLetter(letter)}
                      aria-pressed={activeLetter === letter}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
                {searchField('mobile')}
              </div>

              {!loading && !error && filtered.length > 0 && (
                <nav className="glossary-index" aria-label="Glossary index">
                  {groups.map((g) => (
                    <div className="index-group" key={g.letter}>
                      <div className="index-letter">{g.letter}</div>
                      <div className="index-terms">
                        {g.terms.map((t) => (
                          <button
                            key={t.id}
                            className="index-term"
                            onClick={() => jumpTo(t.id)}
                          >
                            {t.term}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </nav>
              )}
            </aside>

            <div className="glossary-panel">
              {loading ? (
                <div className="glossary-skeleton">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i}>
                      <div className="skeleton skeleton-line" style={{ width: '25%', height: '1.75rem', marginBottom: '0.75rem' }} />
                      <div className="skeleton skeleton-line" style={{ height: '1rem', marginBottom: '0.5rem' }} />
                      <div className="skeleton skeleton-line" style={{ width: '85%', height: '1rem' }} />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="glossary-empty">
                  We couldn't load the glossary right now. Please try again later.
                </div>
              ) : filtered.length === 0 ? (
                <div className="glossary-empty">
                  No terms found{query ? ` for "${query}"` : ''}. Try another search.
                </div>
              ) : (
                groups.map((g) => (
                  <div key={g.letter}>
                    {g.terms.map((t, i) => (
                      <div
                        className="glossary-entry"
                        key={t.id}
                        ref={(el) => {
                          if (el) entryRefs.current[t.id] = el;
                        }}
                      >
                        {i === 0 && <div className="panel-letter">{g.letter}</div>}
                        <div className="entry-term">{t.term}</div>
                        <div className="entry-def">{t.definition}</div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
