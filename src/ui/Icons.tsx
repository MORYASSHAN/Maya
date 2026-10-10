/** Hairline icons, drawn rather than typed. */
export function ArrowIcon({ dir = 'right' }: { dir?: 'right' | 'down' | 'up' | 'out' }) {
  const rot = { right: 0, down: 90, up: -90, out: -45 }[dir]
  return (
    <svg className="icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M1 7h11M8 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
