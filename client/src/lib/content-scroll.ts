/** The app scrolls inside its shell, not the browser window. */
export function resetContentScroll() {
  const content = document.querySelector<HTMLElement>('[data-app-scroll]');
  content?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}
