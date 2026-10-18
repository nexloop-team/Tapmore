/**
 * The sign-in pages' placeholder: the page around it (logo, policy links) is
 * prebuilt static HTML that shows at once, and the form streams in after its
 * quick checks (already signed in? a valid link?).
 */
export default function Loading() {
  return (
    <div className="dash-skeleton" aria-busy="true" aria-label="Loading">
      <div className="dash-skeleton-title" />
      <div className="dash-skeleton-line" />
      <div style={{ height: 44 }} />
      <div style={{ height: 44 }} />
      <div style={{ height: 44 }} />
    </div>
  );
}
