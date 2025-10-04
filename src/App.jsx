import React, { useRef, useState } from "react";

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

function labelFor(kind) {
  if (kind === "NEM") return "Nemesis";
  if (kind.startsWith("P")) return `Player ${kind.slice(1)}`;
  return kind;
}

function cardSrcFor(kind) {
  switch (kind) {
    case "P1": return `${BASE}cards/card-p1.webp`;
    case "P2": return `${BASE}cards/card-p2.webp`;
    case "P3": return `${BASE}cards/card-p3.webp`;
    case "P4": return `${BASE}cards/card-p4.webp`;
    case "P5": return `${BASE}cards/card-p5.webp`;
    case "P6": return `${BASE}cards/card-p6.webp`;
    case "NEM": return `${BASE}cards/card-nemesis.webp`;
    default:    return `${BASE}cards/card-back.webp`;
  }
}

function vibrate(pattern = 25) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}

/* ----- counts <-> deck helpers (splash setup) ----- */
const COUNTS_KEY = "aet-counts-v1";
const DEFAULT_COUNTS = { P1:0,P2:0,P3:0,P4:0,P5:0,P6:0, NEM:0 };

function loadCounts() {
  try {
    const raw = localStorage.getItem(COUNTS_KEY);
    if (!raw) return DEFAULT_COUNTS;
    return { ...DEFAULT_COUNTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_COUNTS;
  }
}
function saveCounts(counts) {
  try { localStorage.setItem(COUNTS_KEY, JSON.stringify(counts)); } catch {}
}
function buildDeckFromCounts(counts) {
  const deck = [];
  const pushMany = (kind, n) => { for (let i = 0; i < n; i++) deck.push({ id: `${kind}${i}`, kind }); };
  for (let i = 1; i <= 6; i++) pushMany(`P${i}`, counts[`P${i}`] || 0);
  pushMany("NEM", counts.NEM || 0);
  return deck;
}

/* ---------- app ---------- */

export default function App() {
  // Core game state
  const [state, setState] = useState(() => ({
    round: 1,
    deck: [],              // built when user hits Begin
    discard: [],
    lastDraw: null,
    showDiscards: false,
    message: "Tap Draw to start.",
  }));

  // Splash setup
  const [begun, setBegun] = useState(false);
  const [draftCounts, setDraftCounts] = useState(loadCounts());

  // Animation control (classic: slide + flip; jitter+fade handled by wrapper)
  const [isAnimating, setIsAnimating] = useState(false);
  const [nextCard, setNextCard] = useState(null);   // upcoming card (bottom layer)
  const [slideOut, setSlideOut] = useState(false);  // top card slides right
  const [underAngle, setUnderAngle] = useState(0);  // bottom card rotation (deg)
  const [topInstant, setTopInstant] = useState(false); // disable top transition briefly
  const [hideTop, setHideTop] = useState(false);       // hide top (first flip)
  const [shuffleFX, setShuffleFX] = useState(false);   // drives CSS jitter+fade

  // Undo history
  const historyRef = useRef([]);

  const pushHistory = () => {
    historyRef.current.push(JSON.parse(JSON.stringify(state)));
    if (historyRef.current.length > 50) historyRef.current.shift();
  };

  // Timings
  const SLIDE_MS   = 250;   // top slide duration
  const FLIP_MS    = 300;   // bottom flip duration
  const SHUFFLE_FX_MS = 1200;    // must match CSS via --shuffle-ms
  const SHUFFLE_SWITCH_AT = 650; // ~54% — inside the 45–55% blackout

  /* ----- Undo tap / Reset hold wiring ----- */
  const LONG_PRESS_MS = 700;
  const undoHoldRef = useRef({ timer: null, start: 0 });
  const [isHoldingUndo, setIsHoldingUndo] = useState(false);

  const onReset = () => {
    if (isAnimating || !begun) return;
    setBegun(false);
    setState((s) => ({
      ...s,
      round: 1,
      deck: [],
      discard: [],
      lastDraw: null,
      showDiscards: false,
      message: "Tap Draw to start.",
    }));
    setDraftCounts(loadCounts());
  };

  const onUndoPressStart = (e) => {
    e.preventDefault();
    if (isAnimating || !begun) return;

    setIsHoldingUndo(true);
    undoHoldRef.current.start = performance.now();

    undoHoldRef.current.timer = setTimeout(() => {
      // long press reached → reset
      setIsHoldingUndo(false);
      undoHoldRef.current.timer = null;
      onReset();
    }, LONG_PRESS_MS);
  };

  const onUndoPressEnd = () => {
    // if we released before LONG_PRESS_MS → do a normal Undo
    if (undoHoldRef.current.timer) {
      clearTimeout(undoHoldRef.current.timer);
      undoHoldRef.current.timer = null;
      setIsHoldingUndo(false);
      onUndo();
    }
  };

  const onUndoPressCancel = () => {
    if (undoHoldRef.current.timer) {
      clearTimeout(undoHoldRef.current.timer);
      undoHoldRef.current.timer = null;
    }
    setIsHoldingUndo(false);
  };

  /* ----- actions ----- */

  function beginWithCounts() {
    saveCounts(draftCounts);
    const fresh = shuffle(buildDeckFromCounts(draftCounts));
    setState((s) => ({
      ...s,
      round: 1,
      deck: fresh,
      discard: [],
      lastDraw: null,
      message: fresh.length ? "Tap Draw to start." : "Deck is empty. Adjust counts and hit Begin.",
    }));
    // reset anim flags
    setNextCard(null);
    setSlideOut(false);
    setUnderAngle(0);
    setHideTop(false);
    setBegun(true);
  }

  const onDraw = () => {
    if (isAnimating || !begun) return;

    if (state.deck.length === 0) {
      setState((s) => ({ ...s, message: "Deck empty. Tap Shuffle to start next round." }));
      return;
    }

    // Determine next card & piles up front
    const next = state.deck[state.deck.length - 1];
    const newDeck = state.deck.slice(0, -1);
    const newDiscard = state.lastDraw ? [state.lastDraw, ...state.discard] : state.discard;

    // Haptics
    if (next.kind === "NEM") vibrate([40, 60, 40]); else vibrate(25);

    pushHistory();
    setIsAnimating(true);

    // Prepare bottom layer: start at 180° so BACK faces viewer
    setNextCard(next);
    setUnderAngle(180);

    const firstDraw = state.lastDraw === null;

    if (firstDraw) {
      // First draw: flip only (hide the top back so the flip is visible)
      setTopInstant(true);
      setHideTop(true);
      requestAnimationFrame(() => setTopInstant(false));

      setTimeout(() => {
        setState((s) => ({
          ...s,
          deck: newDeck,
          discard: newDiscard,
          message: `${labelFor(next.kind)} is coming up…`,
        }));

        setUnderAngle(360); // flip to front

        setTimeout(() => {
          // snap top visible again (no transition), mount new face, cleanup
          setTopInstant(true);
          setHideTop(false);
          setState((s) => ({
            ...s,
            lastDraw: next,
            message: `${labelFor(next.kind)}'s turn.`,
          }));
          setNextCard(null);
          setUnderAngle(0);
          setIsAnimating(false);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => setTopInstant(false));
          });
        }, FLIP_MS);
      }, 20);

    } else {
      // Normal: slide current out, then flip bottom to reveal next
      setSlideOut(true);

      setTimeout(() => {
        setState((s) => ({
          ...s,
          deck: newDeck,
          discard: newDiscard,
          message: `${labelFor(next.kind)} is coming up…`,
        }));

        setUnderAngle(360);

        setTimeout(() => {
          // snap top back (no transition), mount new face
          setTopInstant(true);
          setSlideOut(false);
          setState((s) => ({
            ...s,
            lastDraw: next,
            message: `${labelFor(next.kind)}'s turn.`,
          }));
          setNextCard(null);
          setUnderAngle(0);
          setIsAnimating(false);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => setTopInstant(false));
          });
        }, FLIP_MS);
      }, SLIDE_MS);
    }
  };

  const onUndo = () => {
    if (isAnimating || !begun) return;
    const prev = historyRef.current.pop();
    if (!prev) {
      setState((s) => ({ ...s, message: "Nothing to undo." }));
      return;
    }
    setState(prev);
  };

  const onShuffle = () => {
    if (isAnimating || !begun) return;

    // optional: pushHistory(); // include if you want shuffle to be undoable

    setIsAnimating(true);
    setShuffleFX(true);  // start jitter → fade sequence on the whole stack

    // While it's fully black, swap decks & clear lastDraw so the back shows on fade-in
    setTimeout(() => {
      const nextRound = (state.round ?? 1) + 1;

      setState((s) => ({
        ...s,
        round: nextRound,
        deck: shuffle(buildDeckFromCounts(loadCounts())), // uses splash counts
        discard: [],
        lastDraw: null, // ensures we fade back in to the BACK image
        message: `Round ${nextRound} started. Tap Draw.`,
      }));

      // Reset draw-animation bits while hidden
      setNextCard(null);
      setSlideOut(false);
      setUnderAngle(0);
      setHideTop(false);
      setTopInstant(false);
    }, SHUFFLE_SWITCH_AT);

    // End of the CSS animation: clear flag & unlock controls
    setTimeout(() => {
      setShuffleFX(false);
      setIsAnimating(false);
    }, SHUFFLE_FX_MS);
  };

  const onToggleDiscards = () => {
    if (isAnimating || !begun) return;
    setState((s) => ({ ...s, showDiscards: !s.showDiscards }));
  };

  const remaining = state.deck.length;

  /* ---------- UI ---------- */

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">

      {/* Splash: Deck Setup (Players 1–6 + Enemies) */}
      {!begun && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center px-6">
          <div className="w-full max-w-sm text-center space-y-4">
            <div className="text-neutral-200 text-lg font-semibold">Deck Setup</div>

            <div className="space-y-2">
              {[1,2,3,4,5,6].map((n) => {
                const k = `P${n}`;
                const val = draftCounts[k] ?? 0;
                return (
                  <div key={k} className="flex items-center justify-between bg-neutral-900/60 border border-neutral-700 rounded-xl px-3 py-2">
                    <div className="text-neutral-200 font-semibold">Player {n}</div>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700"
                        onClick={() => setDraftCounts(c => ({ ...c, [k]: Math.max(0, (c[k]||0) - 1) }))}
                      >-</button>
                      <div className="w-8 text-center text-neutral-100">{val}</div>
                      <button
                        className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700"
                        onClick={() => setDraftCounts(c => ({ ...c, [k]: Math.min(6, (c[k]||0) + 1) }))}
                      >+</button>
                    </div>
                  </div>
                );
              })}

              {/* Enemies row */}
              <div className="flex items-center justify-between bg-neutral-900/60 border border-neutral-700 rounded-xl px-3 py-2">
                <div className="text-neutral-200 font-semibold">Enemies</div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700"
                    onClick={() => setDraftCounts(c => ({ ...c, NEM: Math.max(0, (c.NEM||0) - 1) }))}
                  >-</button>
                  <div className="w-8 text-center text-neutral-100">{draftCounts.NEM ?? 0}</div>
                  <button
                    className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700"
                    onClick={() => setDraftCounts(c => ({ ...c, NEM: Math.min(8, (c.NEM||0) + 1) }))}
                  >+</button>
                </div>
              </div>
            </div>

            <button
              onClick={beginWithCounts}
              className="w-full py-4 rounded-xl bg-gradient-to-b from-neutral-700 to-neutral-900 text-neutral-200 border border-neutral-500 ring-1 ring-neutral-400/20 shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:from-neutral-600 hover:to-neutral-800 active:translate-y-px tracking-wide font-semibold"
            >
              Begin
            </button>
          </div>
        </div>
      )}

      {/* Card area with slide + flip; wrapper handles shuffle jitter+fade */}
      <div className="flex-1 flex items-center justify-center px-4 pt-4">
        <div className="w-full max-w-[600px] aspect-[2/3] shadow-xl overflow-hidden">
          <div
            className={`relative w-full h-full [perspective:1000px] ${shuffleFX ? 'animate-jitter-and-fade' : ''}`}
            style={{ ['--shuffle-ms']: `${SHUFFLE_FX_MS}ms` }}  /* keep CSS timing in sync */
          >
            {/* BOTTOM: next card (double-sided) */}
            <div
              className={`absolute inset-0 ${nextCard ? "block" : "hidden"}
                          transform-gpu [transform-style:preserve-3d] transition-transform duration-300 ease-in-out [will-change:transform]`}
              style={{ transform: `rotateY(${underAngle % 360}deg)` }}
            >
              {/* FRONT of bottom = NEXT face */}
              <img
                key={nextCard ? nextCard.id : "none"}
                src={nextCard ? cardSrcFor(nextCard.kind) : `${BASE}cards/card-back.webp`}
                alt={nextCard ? labelFor(nextCard.kind) : "Deck back"}
                className="absolute inset-0 w-full h-full object-cover [backface-visibility:hidden]"
                loading="eager"
                decoding="async"
              />
              {/* BACK of bottom */}
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
                topInstant ? "transition-none" : "transition-transform duration-250 ease-out"
              } ${slideOut ? "translate-x-full" : "translate-x-0"} ${hideTop ? "opacity-0" : "opacity-100"}`}
            >
              <img
                key={state.lastDraw ? state.lastDraw.id : "back"}
                src={state.lastDraw ? cardSrcFor(state.lastDraw.kind) : `${BASE}cards/card-back.webp`}
                alt={state.lastDraw ? labelFor(state.lastDraw.kind) : "Deck back"}
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Status: round + cards remaining */}
      <div className="px-4 mt-4 mb-2">
        <div className="text-center text-sm font-semibold text-slate-200">
          Cards remaining: {remaining}
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] bg-slate-900/90 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
        <div className="max-w-[600px] mx-auto">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={onDraw}
              disabled={isAnimating || !begun}
              title={isAnimating ? "Animating…" : "Draw"}
              className="py-4 rounded-xl bg-gradient-to-b from-violet-600/90 to-indigo-800/90 border border-violet-300/50 shadow-[0_6px_18px_rgba(0,0,0,0.55)] ring-1 ring-violet-200/30 hover:from-violet-500 hover:to-indigo-700 active:translate-y-px text-amber-100 tracking-wide font-extrabold disabled:opacity-50"
            >
              Draw
            </button>

            {/* Undo / Reset (tap = Undo, hold = Reset) */}
            <button
              onMouseDown={onUndoPressStart}
              onMouseUp={onUndoPressEnd}
              onMouseLeave={onUndoPressCancel}
              onTouchStart={onUndoPressStart}
              onTouchEnd={onUndoPressEnd}
              onTouchCancel={onUndoPressCancel}
              disabled={isAnimating || !begun}  /* keep enabled even if no history so hold-to-reset still works */
              title={
                isAnimating
                  ? "Animating…"
                  : (isHoldingUndo ? "Keep holding to Reset" : "Tap: Undo · Hold: Reset")
              }
              className={`relative py-4 rounded-xl bg-gradient-to-b from-slate-700/90 to-slate-900/90 border border-slate-300/30 shadow-[0_6px_18px_rgba(0,0,0,0.55)] ring-1 ring-slate-200/20 hover:from-slate-600 hover:to-slate-800 active:translate-y-px text-slate-100 tracking-wide font-semibold disabled:opacity-50 ${
                isHoldingUndo ? 'ring-2 ring-red-400/70 border-red-300/50' : ''
              }`}
            >
              {/* Hold progress bar (fills to confirm reset) */}
              <span
                className="pointer-events-none absolute left-0 top-0 h-1 bg-red-400/80"
                style={{
                  width: isHoldingUndo ? '100%' : '0%',
                  transition: `width ${LONG_PRESS_MS}ms linear`
                }}
              />
              Undo / Reset
            </button>

            <button
              onClick={onShuffle}
              disabled={isAnimating || !begun}
              title={isAnimating ? "Animating…" : "Shuffle"}
              className="py-4 rounded-xl bg-gradient-to-b from-emerald-600/90 to-teal-800/90 border border-emerald-300/50 shadow-[0_6px_18px_rgba(0,0,0,0.55)] ring-1 ring-emerald-200/30 hover:from-emerald-500 hover:to-teal-700 active:translate-y-px text-amber-100 tracking-wide font-extrabold disabled:opacity-50"
            >
              Shuffle
            </button>
          </div>

          <div className="mt-3">
            <button
              onClick={onToggleDiscards}
              disabled={isAnimating || !begun}
              className="w-full py-4 rounded-xl bg-gradient-to-b from-neutral-700 to-neutral-900 text-neutral-200 border border-neutral-500 ring-1 ring-neutral-400/20 shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:from-neutral-600 hover:to-neutral-800 active:translate-y-px tracking-wide font-semibold disabled:opacity-50"
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
