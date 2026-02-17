/**
 * Window Spec - Value Object
 *
 * Defines a sliding time window for aggregation computations.
 * Immutable — no identity, no mutation.
 */
export interface WindowSpec {
  /** Duration of the window (e.g., 24, 7, 30) */
  duration: number;
  /** Time unit */
  unit: 'minutes' | 'hours' | 'days';
}

/**
 * Window bounds computed from an anchor timestamp.
 * [start, end) — inclusive start, exclusive end.
 */
export interface WindowBounds {
  /** Inclusive start of the window */
  start: Date;
  /** Exclusive end of the window (= anchor timestamp) */
  end: Date;
}
