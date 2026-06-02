import { useEffect, useRef, useState } from 'react'

const TFL_RED = '#dc241f'

// Oyster card reader button — amber pad, thick dark bezel, card+swoosh logo
function OysterButton({ onClick, isLoading }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  const scale = pressed ? 0.93 : hovered ? 1.05 : 1
  const shadow = pressed
    ? 'inset 0 6px 14px rgba(0,0,0,0.55), inset 0 -1px 2px rgba(255,220,80,0.1), 0 2px 6px rgba(0,0,0,0.25)'
    : hovered
    ? 'inset 0 2px 6px rgba(0,0,0,0.25), inset 0 -3px 6px rgba(255,220,100,0.4), 0 10px 30px rgba(0,0,0,0.35)'
    : 'inset 0 3px 8px rgba(0,0,0,0.35), inset 0 -2px 4px rgba(255,220,100,0.3), 0 6px 20px rgba(0,0,0,0.3)'

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Spinning arc ring — visible while loading */}
      {isLoading && (
        <div className="oyster-ring" style={s.ring} />
      )}

      <button
        onClick={isLoading ? undefined : onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false) }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        aria-label="Tap On"
        style={{
          ...s.oyster,
          transform: `scale(${scale})`,
          transition: pressed
            ? 'transform 0.08s ease, box-shadow 0.08s ease'
            : 'transform 0.2s ease, box-shadow 0.2s ease',
          boxShadow: shadow,
          cursor: isLoading ? 'default' : 'pointer',
        }}
      >
      {/* Oyster card + swoosh logo */}
      <svg viewBox="0 0 80 60" style={{ width: 80, height: 60 }}>
        {/* Card shape — slightly tilted */}
        <rect
          x="16" y="4" width="42" height="28" rx="5" ry="5"
          fill="rgba(255,255,255,0.88)"
          transform="rotate(-8, 37, 18)"
        />
        {/* Swoosh / arc beneath the card */}
        <path
          d="M 8 46 Q 40 28 72 46"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      </button>
    </div>
  )
}

export default function Landing({ phase, onTap, onFadeEnd }) {
  const isSpinning = phase === 'spinning' || phase === 'fading'
  const overlayRef = useRef(null)

  useEffect(() => {
    if (phase === 'fading' && overlayRef.current) {
      overlayRef.current.addEventListener('animationend', onFadeEnd, { once: true })
    }
  }, [phase, onFadeEnd])

  return (
    <div
      ref={overlayRef}
      className={phase === 'fading' ? 'landing-fading' : ''}
      style={s.overlay}
    >
      <div style={s.content}>

        {/* Headline — left-aligned, factual opener */}
        <p style={s.headline}>London runs on 9,000 buses</p>

        {/* Listicle — centred, large, clean */}
        <div style={s.listicleBlock}>
          <p style={s.listicle}>The commute.</p>
          <p style={s.listicle}>The school bus.</p>
          <p style={s.listicle}>The night shift.</p>
          <p style={s.listicle}>The rail replacement.</p>
        </div>

        {/* One quiet fact line */}
        <p style={s.fact}>
          Some routes have run the same streets for over a hundred years.
        </p>

        {/* Oyster tap button */}
        <div style={s.buttonArea}>
          <OysterButton onClick={onTap} isLoading={isSpinning} />
          <span style={s.tapLabel}>Tap On</span>
        </div>

      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: '#ffffff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Inter, system-ui, sans-serif',
  },

  content: {
    maxWidth: 540,
    width: '100%',
    padding: '0 36px',
  },

  // "London runs on 9,000 buses" — top-left weight, not centred
  headline: {
    fontSize: 38,
    fontWeight: 400,
    color: '#1a1a1a',
    margin: '0 0 56px',
    lineHeight: 1.2,
    letterSpacing: '-0.4px',
    textAlign: 'left',
  },

  listicleBlock: {
    marginBottom: 52,
    textAlign: 'center',
  },

  listicle: {
    fontSize: 28,
    fontWeight: 400,
    color: '#1a1a1a',
    margin: '0 0 2px',
    lineHeight: 1.35,
    letterSpacing: '-0.2px',
  },

  fact: {
    fontSize: 16,
    fontWeight: 400,
    color: '#aaa',
    margin: '0 0 60px',
    textAlign: 'center',
    lineHeight: 1.5,
    letterSpacing: 0,
  },

  buttonArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },

  // Spinning ring outside the bezel — loading indicator
  ring: {
    position: 'absolute',
    top: -10, left: -10,
    width: 150, height: 150,
    borderRadius: '50%',
    border: '3px solid transparent',
    borderTopColor: '#f7b731',
    borderRightColor: '#f7b731',
    pointerEvents: 'none',
    zIndex: 1,
  },

  // Oyster reader: thick dark bezel + amber pad
  oyster: {
    width: 130,
    height: 130,
    borderRadius: '50%',
    border: '10px solid #1c1c1c',
    background: 'radial-gradient(circle at 38% 38%, #f7b731, #e8970a)',
    boxShadow:
      'inset 0 3px 8px rgba(0,0,0,0.35), inset 0 -2px 4px rgba(255,220,100,0.3), 0 6px 20px rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    outline: 'none',
    padding: 0,
    transition: 'transform 0.12s, box-shadow 0.12s',
  },

  tapLabel: {
    fontSize: 20,
    fontWeight: 700,
    color: TFL_RED,
    letterSpacing: '-0.2px',
    fontFamily: 'Inter, system-ui, sans-serif',
    userSelect: 'none',
  },
}
