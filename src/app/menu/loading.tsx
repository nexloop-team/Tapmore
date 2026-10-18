import "@/styles/landing.css";

/**
 * Placeholder while a hosted menu streams in, shaped like the menu (back
 * bar, category chips, dishes) so nothing jumps when it arrives.
 */
export default function Loading() {
  return (
    <main className="page-wrapper skeleton" aria-busy="true" aria-label="Loading">
      <div className="skeleton-menu-bar" />
      <div className="skeleton-chips">
        <div />
        <div />
        <div />
        <div />
      </div>
      <div className="skeleton-dishes">
        <div />
        <div />
        <div />
        <div />
        <div />
      </div>
    </main>
  );
}
