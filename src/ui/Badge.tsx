import type { Status } from '../content/phases'

/** Status as quiet text with a small light, not a glowing pill. */
export function Badge({ status }: { status: Status }) {
  return <span className={`status status--${status}`}>{status === 'live' ? 'Live' : 'In development'}</span>
}
