import { useEffect, useRef } from 'react'

const TFL_RED = '#dc241f'

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
      style={styles.overlay}
    >
      <div style={styles.content}>

        <p style={styles.headline}>London runs on 9,000 buses.</p>

        <div style={styles.block}>
          <p style={styles.body}>Every day, over six million journeys.</p>
          <p style={styles.body}>Every night, fifty routes that never sleep.</p>
        </div>

        <div style={styles.block}>
          <p style={styles.listicle}>The commute.</p>
          <p style={styles.listicle}>The school run.</p>
          <p style={styles.listicle}>The night shift.</p>
          <p style={styles.listicle}>The last bus home.</p>
        </div>

        <div style={styles.block}>
          <p style={styles.body}>
            One in six Londoners takes the bus every single day.
          </p>
          <p style={styles.body}>
            Some routes have served the same streets for over a hundred years.
          </p>
        </div>

        <div style={styles.block}>
          <p style={styles.intro}>
            <strong>Headway</strong> maps the live pulse of London's bus network —
            every route, every bus, in real time.
          </p>
        </div>

        {/* Oyster-style tap button */}
        <div style={styles.buttonWrap}>
          <button
            onClick={isSpinning ? undefined : onTap}
            style={{ ...styles.oysterButton, cursor: isSpinning ? 'default' : 'pointer' }}
            aria-label="Enter Headway"
          >
            {/* Curved arrow — spins around the button centre when loading */}
            <div className={isSpinning ? 'landing-arrow-spin' : ''} style={styles.arrowLayer}>
              <svg
                viewBox="0 0 140 140"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              >
                <defs>
                  <marker
                    id="lp-arrowhead"
                    markerWidth="7" markerHeight="7"
                    refX="3.5" refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0,0 7,3.5 0,7" fill={TFL_RED} />
                  </marker>
                </defs>
                {/* Quarter-circle arc from bottom-left to top-right inside the button */}
                <path
                  d="M 32 108 A 54 54 0 0 1 108 32"
                  stroke={TFL_RED}
                  strokeWidth="2.5"
                  fill="none"
                  markerEnd="url(#lp-arrowhead)"
                />
              </svg>
            </div>

            <span style={styles.tapLabel}>Tap On</span>
          </button>

          <p style={styles.tapHint}>tap to board</p>
        </div>

      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: '#ffffff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Inter, system-ui, sans-serif',
  },

  content: {
    maxWidth: 560,
    padding: '40px 32px',
    width: '100%',
  },

  headline: {
    fontSize: 36, fontWeight: 400, color: '#1a1a1a',
    margin: '0 0 40px',
    lineHeight: 1.2,
    letterSpacing: '-0.5px',
  },

  block: {
    marginBottom: 36,
  },

  body: {
    fontSize: 18, fontWeight: 400, color: '#444',
    margin: '0 0 6px',
    lineHeight: 1.5,
  },

  listicle: {
    fontSize: 26, fontWeight: 400, color: '#1a1a1a',
    margin: '0 0 2px',
    lineHeight: 1.3,
    letterSpacing: '-0.3px',
  },

  intro: {
    fontSize: 17, fontWeight: 400, color: '#555',
    lineHeight: 1.6,
    margin: 0,
  },

  buttonWrap: {
    marginTop: 52,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12,
  },

  oysterButton: {
    position: 'relative',
    width: 140, height: 140,
    borderRadius: '50%',
    border: '2px solid #1a1a1a',
    background: '#f9f9f9',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
    outline: 'none',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },

  arrowLayer: {
    position: 'absolute', inset: 0,
    borderRadius: '50%',
    overflow: 'visible',
  },

  tapLabel: {
    fontSize: 22, fontWeight: 700,
    color: TFL_RED,
    fontFamily: 'Inter, system-ui, sans-serif',
    letterSpacing: '-0.3px',
    position: 'relative', // above the SVG layer
    zIndex: 1,
    userSelect: 'none',
  },

  tapHint: {
    fontSize: 12, color: '#bbb',
    fontFamily: 'Inter, system-ui, sans-serif',
    margin: 0, letterSpacing: '0.06em',
  },
}
