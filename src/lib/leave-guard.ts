/**
 * Does this click take the owner away from the page they're editing? Only a
 * plain left click on a link to another page of this site does: new tabs,
 * downloads, other sites (the browser's own "Leave site?" covers those) and
 * jumps within the page are left alone. Returns where it goes, or null.
 */
export function leavingHref(
  click: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean },
  link: { href: string; target: string; download: boolean },
  current: string,
): string | null {
  if (click.defaultPrevented || click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  if ((link.target && link.target !== "_self") || link.download) return null;
  let to: URL;
  let from: URL;
  try {
    from = new URL(current);
    to = new URL(link.href, from);
  } catch {
    return null;
  }
  if (to.origin !== from.origin) return null;
  if (to.pathname === from.pathname && to.search === from.search) return null;
  return `${to.pathname}${to.search}${to.hash}`;
}
