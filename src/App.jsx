import React, { useRef, useState, useEffect } from "react";
import { initPWA } from "./pwa";

/* Vite base path: '/' in dev, '/aeturnorder-app/' on GitHub Pages */
const BASE = import.meta.env.BASE_URL;

/* ---------- helpers ---------- */

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeBaseDeck() {
  return [
    { id: "P1a", kind: "P1" },
    { id: "P1b", kind: "P1" },
    { id: "P2a", kind: "P2" },
    { id: "P2b", kind: "P2" },
    { id: "NEMa", kind: "NEM" },
    { id: "NEMb", kind: "NEM" },
  ];
}

function labelFor(kind) {
  if (kind === "P1") return "Player 1";
  if (kind === "P2") return "Player 2";
  if (kind === "NEM") return "Nemesis";
  return kind;
}

function cardSrcFor(kind) {
  switch (kind) {
    case "P1": return `${BASE}cards/card-p1.webp`;
    case "P2": return `${BASE}cards/card-p2.webp`;
    case "NEM": return `${BASE}cards/card-nemesis.webp`;
    default:   return `${BASE}cards/card-back.webp`;
  }
}

function vibrate(pattern = 25) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}


/* ---------- app ---------- */

export default function App() {
  const [state, setState] = useState(() => ({
    round: 1,
    deck: shuffle(makeBaseDeck()),
    discard: [],
    lastDraw: null,
    showDiscards: false,
    message: "Tap Draw to start.",
  }));

  // animation control
  const [isAnimating, setIsAnimating] = useState(false);

  // NEW: slide + flip states (for the two-layer card animation)
  const [nextCard, setNextCard] = useState(null);   // holds upcoming card during animation
  const [slideOut, setSlideOut] = useState(false);  // top card slides right when true
  const [underAngle, setUnderAngle] = useState(0);  // bottom card rotation in degrees

  // history
  const historyRef = useRef([]);

  // PWA update banner
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    initPWA((confirmReload) => {
      setUpdateReady(true);
      window.__doUpdate = confirmReload;
    });
  }, []);


  const pushHistory = () => {
    historyRef.current.push(JSON.parse(JSON.stringify(state)));
    if (historyRef.current.length > 50) historyRef.current.shift();
  };

  // disables the top card transition when we snap it back to center
  const [topInstant, setTopInstant] = useState(false);

  // hide top card (instantly) so the first draw’s flip is visible underneath
  const [hideTop, setHideTop] = useState(false);

const SLIDE_MS = 250; // keep in sync with duration-250 on the top layer
const FLIP_MS  = 300; // keep in sync with duration-300 on the bottom (flip) layer

const onDraw = () => {
  if (isAnimating) return;

  if (state.deck.length === 0) {
    setState((s) => ({ ...s, message: "Deck empty. Tap Shuffle to start next round." }));
    return;
  }

  // compute next card & piles up front
  const next = state.deck[state.deck.length - 1];
  const newDeck = state.deck.slice(0, -1);
  const newDiscard = state.lastDraw ? [state.lastDraw, ...state.discard] : state.discard;

  // haptics
  if (next.kind === 'NEM') vibrate([40, 60, 40]); else vibrate(25);

  pushHistory();
  setIsAnimating(true);

  const firstDraw = state.lastDraw === null;

  // Prep bottom: start at 180° so BACK faces the viewer
  setNextCard(next);
  setUnderAngle(180);

  if (firstDraw) {
    // ---------- FIRST DRAW: FLIP ONLY ----------
    // Hide the top back instantly so the flip is visible underneath
    setTopInstant(true);
    setHideTop(true);
    requestAnimationFrame(() => setTopInstant(false)); // restore transitions for later

    // small tick to ensure the 180° state paints
    setTimeout(() => {
      // update piles before reveal
      setState((s) => ({
        ...s,
        deck: newDeck,
        discard: newDiscard,
        message: `${labelFor(next.kind)} is coming up…`,
      }));

      // flip BACK (180) -> FRONT (360)
      setUnderAngle(360);

      // ----- END of FIRST DRAW branch (different ending) -----
      setTimeout(() => {
        // snap top visible (no transitions) so it doesn't animate in
        setTopInstant(true);
        setHideTop(false);

        // now mount the new face
        setState((s) => ({
          ...s,
          lastDraw: next,
          message: `${labelFor(next.kind)}'s turn.`,
        }));

        // cleanup
        setNextCard(null);
        setUnderAngle(0);
        setIsAnimating(false);

        // re-enable transitions after snap has painted
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTopInstant(false);
          });
        });
      }, FLIP_MS);
    }, 20);

  } else {
    // ---------- NORMAL DRAWS: SLIDE THEN FLIP ----------
    // 1) slide the current face off-screen
    setSlideOut(true);

    // after slide completes…
    setTimeout(() => {
      // update piles
      setState((s) => ({
        ...s,
        deck: newDeck,
        discard: newDiscard,
        message: `${labelFor(next.kind)} is coming up…`,
      }));

      // 2) flip bottom BACK (180) -> FRONT (360)
      setUnderAngle(360);

      // ----- END of NORMAL branch (different ending) -----
      setTimeout(() => {
        // snap top back to center *without* transitions BEFORE mounting new face
        setTopInstant(true);
        setSlideOut(false);

        // now mount the new face and clear anim bits
        setState((s) => ({
          ...s,
          lastDraw: next,
          message: `${labelFor(next.kind)}'s turn.`,
        }));
        setNextCard(null);
        setUnderAngle(0);
        setIsAnimating(false);

        // re-enable transitions after the snap has painted (double RAF = robust on desktop)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTopInstant(false);
          });
        });
      }, FLIP_MS);
    }, SLIDE_MS);
  }
};



  const onUndo = () => {
    if (isAnimating) return;
    const prev = historyRef.current.pop();
    if (!prev) {
      setState((s) => ({ ...s, message: "Nothing to undo." }));
      return;
    }
    setState(prev);
  };

  const onShuffle = () => {
    if (isAnimating) return;
    pushHistory();
    setState((s) => ({
      ...s,
      round: s.round + 1,
      deck: shuffle(makeBaseDeck()),
      discard: [],
      lastDraw: null,
      message: `Round ${s.round + 1} started. Tap Draw.`,
    }));
    // Reset animation bits
    setNextCard(null);
    setSlideOut(false);
    setUnderAngle(0);
    setHideTop(false);
  };

  const onToggleDiscards = () => {
    if (isAnimating) return;
    setState((s) => ({ ...s, showDiscards: !s.showDiscards }));
  };

  const remaining = state.deck.length;

  return (
    <div className="min-h-[100svh] bg-slate-900 text-slate-100 flex flex-col overflow-hidden pt-[max(env(safe-area-inset-top),10px)] pb-[max(env(safe-area-inset-bottom),10px)]">
      {/* Card area */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 mb-2">
        {/* Card frame */}
        <div className="w-full max-w-[600px] aspect-[63/88] shadow-xl overflow-hidden">
          <div className="relative w-full h-full [perspective:1000px]">
            {/* BOTTOM: “next” card (double-sided). Visible while nextCard is set */}
            <div
              className={`absolute inset-0 ${nextCard ? 'block' : 'hidden'} 
                          transform-gpu [transform-style:preserve-3d] transition-transform duration-300 ease-in-out [will-change:transform]`}
              style={{ transform: `rotateY(${underAngle % 360}deg)` }}
            >
              {/* FRONT of bottom = the NEXT card face */}
              <img
                key={nextCard ? nextCard.id : 'none'}
                src={nextCard ? cardSrcFor(nextCard.kind) : `${BASE}cards/card-back.webp`}
                alt={nextCard ? labelFor(nextCard.kind) : 'Deck back'}
                className="absolute inset-0 w-full h-full object-cover [backface-visibility:hidden]"
                loading="eager"
                decoding="async"
              />
              {/* BACK of bottom = card back */}
              <img
                src={`${BASE}cards/card-back.webp`}
                alt="Card back"
                className="absolute inset-0 w-full h-full object-cover [backface-visibility:hidden] [transform:rotateY(180deg)]"
                loading="eager"
                decoding="async"
              />
            </div>

            {/* TOP: current face-up card that slides away */}
              <div
                className={`absolute inset-0 will-change-transform ${
                  topInstant ? 'transition-none' : 'transition-transform duration-250 ease-out'
                } ${slideOut ? 'translate-x-full' : 'translate-x-0'} ${hideTop ? 'opacity-0' : 'opacity-100'}`}
              >

              <img
                key={state.lastDraw ? state.lastDraw.id : 'back'}
                src={state.lastDraw ? cardSrcFor(state.lastDraw.kind) : `${BASE}cards/card-back.webp`}
                alt={state.lastDraw ? labelFor(state.lastDraw.kind) : 'Deck back'}
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </div>


        {/* NEW: Cards left (below card, full width) */}
        <div className="mt-1 mb-1 text-center text-sm sm:text-base text-slate-300">
            Cards left:{" "}
            <span className="font-semibold text-slate-100">{remaining}</span>
        </div>

        {/* Update banner (unchanged) */}
        {updateReady && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-amber-500 text-black px-4 py-2 rounded-xl shadow-lg flex items-center gap-3 z-[9999]">
            <span>Update available</span>
            <button
              className="px-3 py-1 rounded-lg bg-black text-white"
              onClick={() => window.__doUpdate?.()}
            >
              Reload
            </button>
          </div>
        )}
      </div>


      {/* Controls */}
      <div className="px-4 pt-1 pb-1 bg-slate-900/90 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
        <div className="max-w-[600px] mx-auto">
          {/* Top row: Draw, Undo, Shuffle */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={onDraw}
              disabled={isAnimating}
              title={isAnimating ? "Animating…" : "Draw"}
              className="py-4 rounded-xl bg-gradient-to-b from-violet-600/90 to-indigo-800/90 border border-violet-300/50 shadow-[0_6px_18px_rgba(0,0,0,0.55)] ring-1 ring-violet-200/30 hover:from-violet-500 hover:to-indigo-700 active:translate-y-px text-amber-100 tracking-wide font-extrabold"
            >
              Draw
            </button>

            <button
              onClick={onUndo}
              disabled={historyRef.current.length === 0 || isAnimating}
              title={historyRef.current.length === 0 ? "Nothing to undo" : "Undo"}
              className="py-4 rounded-xl bg-gradient-to-b from-slate-700/90 to-slate-900/90 border border-slate-300/30 shadow-[0_6px_18px_rgba(0,0,0,0.55)] ring-1 ring-slate-200/20 hover:from-slate-600 hover:to-slate-800 active:translate-y-px text-slate-100 tracking-wide font-semibold disabled:opacity-50"
            >
              Undo
            </button>

            <button
              onClick={onShuffle}
              disabled={isAnimating}
              title={isAnimating ? "Animating…" : "Shuffle"}
              className="py-4 rounded-xl bg-gradient-to-b from-emerald-600/90 to-teal-800/90 border border-emerald-300/50 shadow-[0_6px_18px_rgba(0,0,0,0.55)] ring-1 ring-emerald-200/30 hover:from-emerald-500 hover:to-teal-700 active:translate-y-px text-amber-100 tracking-wide font-extrabold"
            >
              Shuffle
            </button>
          </div>

          {/* Bottom row: Display/Hide Discards */}
          <div className="mt-3">
            <button
              onClick={onToggleDiscards}
              disabled={isAnimating}
              className="w-full py-4 rounded-xl bg-gradient-to-b from-neutral-700 to-neutral-900 text-neutral-200 border border-neutral-500 ring-1 ring-neutral-400/20 shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:from-neutral-600 hover:to-neutral-800 active:translate-y-px tracking-wide font-semibold"
            >
              {state.showDiscards ? "Hide Discards" : "Display Discards"}
            </button>
          </div>
        </div>
      </div>

      {/* Discards sheet */}
      {state.showDiscards && (
        <div
          className="fixed inset-0 z-50"
          aria-modal="true"
          role="dialog"
          onClick={() => setState((s) => ({ ...s, showDiscards: false }))}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute inset-x-0 bottom-0 bg-slate-950/95 rounded-t-2xl border-t border-slate-700 shadow-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-600/60" />
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Discards</h2>
              <button
                onClick={() => setState((s) => ({ ...s, showDiscards: false }))}
                className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
            {state.discard.length === 0 ? (
              <div className="text-sm opacity-70">None yet.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {state.discard.map((c, idx) => (
                  <div
                    key={`d_${c.id}_${idx}`}
                    className="rounded-md border border-slate-700 bg-slate-800/60 overflow-hidden"
                    style={{ width: "15%" }}
                    title={labelFor(c.kind)}
                  >
                    <div className="w-full aspect-[63/88]">
                      <img
                        src={cardSrcFor(c.kind)}
                        alt={labelFor(c.kind)}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
