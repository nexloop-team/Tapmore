/** Outline of a card on the till while it loads (opened from a list, or a direct link), so a tap never looks ignored. */
export default function Loading() {
  return (
    <div className="dash-skeleton" aria-busy="true" aria-label="Opening card">
      <div className="dash-skeleton-line" style={{ width: 160 }} />
      <div className="dash-skeleton-card" />
      <div style={{ height: 64 }} />
      <div style={{ height: 52 }} />
    </div>
  );
}
