import React, { useRef, useState } from "react";

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
    case "P1": return "/cards/card-p1.webp";
    case "P2": return "/cards/card-p2.webp";
    case "NEM": return "/cards/card-nemesis.webp";
    default:   return "/cards/card-back.webp";
  }
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

  // fade controls
  const [isCardVisible, setIsCardVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  // simple undo stack of previous states
  const historyRef = useRef([]);

  const pushHistory = () => {
    historyRef.current.push(JSON.parse(JSON.stringify(state)));
    if (historyRef.current.length > 50) historyRef.current.shift();
  };

  const onDraw = () => {
    if (isAnimating) return; // ignore spam during fade
    if (state.deck.length === 0) {
      setState((s) => ({ ...s, message: "Deck empty. Tap Shuffle to start next round." }));
      return;
    }

    // Prepare next values first so timing doesn’t race with state
    const next = state.deck[state.deck.length - 1];
    const newDeck = state.deck.slice(0, -1);
    const newDiscard = [next, ...state.discard];

    pushHistory();
    setIsAnimating(true);
    setIsCardVisible(false); // fade out
    // After fade-out, swap the card + fade in
    setTimeout(() => {
      setState((s) => ({
        ...s,
        deck: newDeck,
        discard: newDiscard,
        lastDraw: next,
        message: `${labelFor(next.kind)}'s turn.`,
      }));
      setIsCardVisible(true); // fade in
      // give the fade-in a beat before re-enabling clicks
      setTimeout(() => setIsAnimating(false), 180);
    }, 180); // keep these in sync with duration-200 (close enough)
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
  };

  const onToggleDiscards = () => {
    if (isAnimating) return;
    setState((s) => ({ ...s, showDiscards: !s.showDiscards }));
  };

  const remaining = state.deck.length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-4 pt-4">
        <div className="w-full max-w-[600px] aspect-[63/88] shadow-x1 overflow-hidden">
          {/* Fade wrapper */}
          <div
            className={`w-full h-full transition-opacity duration-200 ${isCardVisible ? "opacity-100" : "opacity-0"}`}
          >
            {state.lastDraw ? (
              <img
                src={
                  state.lastDraw.kind === "P1"
                    ? "/cards/card-p1.webp"
                    : state.lastDraw.kind === "P2"
                    ? "/cards/card-p2.webp"
                    : "/cards/card-nemesis.webp"
                }
                alt={labelFor(state.lastDraw.kind)}
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            ) : (
              <img
                src="/cards/card-back.webp"
                alt="Deck back"
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] bg-slate-900/90 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
        <div className="max-w-[600px] mx-auto">
          {/* Top row: Draw, Undo, Shuffle */}
          <div className="grid grid-cols-3 gap-3">
            {/* Draw — arcane violet */}
            <button
              onClick={onDraw}
              disabled={isAnimating}
              title={isAnimating ? "Animating…" : "Draw"}
              className="py-4 rounded-xl
                        bg-gradient-to-b from-violet-600/90 to-indigo-800/90
                        border border-violet-300/50
                        shadow-[0_6px_18px_rgba(0,0,0,0.55)] ring-1 ring-violet-200/30
                        hover:from-violet-500 hover:to-indigo-700
                        active:translate-y-px
                        text-amber-100 tracking-wide font-extrabold"
            >
              Draw
            </button>

            {/* Undo — tempered steel */}
            <button
              onClick={onUndo}
              disabled={historyRef.current.length === 0 || isAnimating}
              title={historyRef.current.length === 0 ? "Nothing to undo" : "Undo"}
              className="py-4 rounded-xl
                        bg-gradient-to-b from-slate-700/90 to-slate-900/90
                        border border-slate-300/30
                        shadow-[0_6px_18px_rgba(0,0,0,0.55)] ring-1 ring-slate-200/20
                        hover:from-slate-600 hover:to-slate-800
                        active:translate-y-px
                        text-slate-100 tracking-wide font-semibold disabled:opacity-50"
            >
              Undo
            </button>

            {/* Shuffle — verdant swirl */}
            <button
              onClick={onShuffle}
              disabled={isAnimating}
              title={isAnimating ? "Animating…" : "Shuffle"}
              className="py-4 rounded-xl
                        bg-gradient-to-b from-emerald-600/90 to-teal-800/90
                        border border-emerald-300/50
                        shadow-[0_6px_18px_rgba(0,0,0,0.55)] ring-1 ring-emerald-200/30
                        hover:from-emerald-500 hover:to-teal-700
                        active:translate-y-px
                        text-amber-100 tracking-wide font-extrabold"
            >
              Shuffle
            </button>
          </div>

          {/* Bottom row: Display/Hide Discards */}
          <div className="mt-3">
            <button
              onClick={onToggleDiscards}
              disabled={isAnimating}
                  className="w-full py-4 rounded-xl
                            bg-gradient-to-b from-neutral-700 to-neutral-900
                            text-neutral-200
                            border border-neutral-500 ring-1 ring-neutral-400/20
                            shadow-[0_4px_12px_rgba(0,0,0,0.5)]
                            hover:from-neutral-600 hover:to-neutral-800
                            active:translate-y-px tracking-wide font-semibold"
            >
              {state.showDiscards ? "Hide Discards" : "Display Discards"} 
            </button>
          </div>
        </div>
      </div>


      {/* Backdrop + Bottom Sheet for Discards */}
      {state.showDiscards && (
        <div
          className="fixed inset-0 z-50"
          aria-modal="true"
          role="dialog"
          onClick={() => setState((s) => ({ ...s, showDiscards: false }))}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" />

          {/* Sheet */}
            <div
              className="absolute inset-x-0 bottom-0 bg-slate-950/95 rounded-t-2xl border-t border-slate-700
                        shadow-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]
                        max-h-[70vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >

            {/* Grab handle */}
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
                    style={{ width: "15%" }} // ~15% of sheet width
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

