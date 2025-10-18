export interface StandaloneDetectionOptions {
  /**
   * Whether a display-mode media query has confirmed a standalone context.
   */
  matchMediaStandalone?: boolean;
  /**
   * The normalized display-mode string reported by the browser, when available.
   */
  displayMode?: string | null;
  /**
   * iOS Safari exposes a proprietary navigator.standalone flag when running as a PWA.
   */
  navigatorStandalone?: boolean | null | undefined;
}

const STANDALONE_DISPLAY_MODES = new Set([
  'standalone',
  'minimal-ui',
  'fullscreen',
  'window-controls-overlay',
]);

/**
 * Determines whether the current window is running inside an installed PWA shell.
 */
export function computeStandaloneMode(options: StandaloneDetectionOptions): boolean {
  const { matchMediaStandalone, displayMode, navigatorStandalone } = options;

  if (matchMediaStandalone === true) {
    return true;
  }

  const normalizedMode = (displayMode ?? '').trim().toLowerCase();
  if (normalizedMode.length > 0 && STANDALONE_DISPLAY_MODES.has(normalizedMode)) {
    return true;
  }

  return navigatorStandalone === true;
}
