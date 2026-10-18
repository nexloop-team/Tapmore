/** Outline of the till's home (scan button, search, list) while it loads, e.g. after a search. */
export default function Loading() {
  return (
    <div className="dash-skeleton" aria-busy="true" aria-label="Loading">
      <div style={{ height: 150 }} />
      <div className="dash-skeleton-line" />
      <div style={{ height: 52 }} />
      <div className="dash-skeleton-card short" />
    </div>
  );
}
