/**
 * Grey outlines of dashboard pages while the real ones load (see the
 * loading.tsx files), each shaped like its page so nothing jumps when it
 * arrives. Built from the .dash-skeleton blocks in app.css.
 */

function Head() {
  return (
    <>
      <div className="dash-skeleton-title" />
      <div className="dash-skeleton-line" />
    </>
  );
}

/** An editor: section tabs and cards, with the phone preview beside them on wide screens. */
export function EditorSkeleton() {
  return (
    <div className="dash-skeleton" aria-busy="true" aria-label="Loading">
      <Head />
      <div className="editor-grid dash-skeleton-group">
        <div className="dash-skeleton dash-skeleton-group">
          <div style={{ height: 44 }} />
          <div className="dash-skeleton-card" />
          <div className="dash-skeleton-card short" />
        </div>
        <aside className="preview-pane" aria-hidden>
          <div className="phone dash-skeleton-phone" />
        </aside>
      </div>
    </div>
  );
}

/** A list page: filters, then rows (guests, feedback). */
export function ListSkeleton() {
  return (
    <div className="dash-skeleton" aria-busy="true" aria-label="Loading">
      <Head />
      <div className="dash-skeleton-filters" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{ height: 56 }} />
      ))}
    </div>
  );
}

/** A settings-style page: a few cards of fields. */
export function FormSkeleton() {
  return (
    <div className="dash-skeleton" aria-busy="true" aria-label="Loading">
      <Head />
      <div className="dash-skeleton-card" />
      <div className="dash-skeleton-card short" />
    </div>
  );
}
