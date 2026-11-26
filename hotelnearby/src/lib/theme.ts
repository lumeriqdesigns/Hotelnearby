export const THEME_STORAGE_KEY = "hn-theme";
export const THEME_CHANGE_EVENT = "hn-theme-change";

export type ThemePreference = "system" | "light" | "dark";

/**
 * Runs in <head> before first paint so a saved choice never flashes the wrong theme.
 * "system" (no saved value) leaves the attribute off and lets the OS preference decide.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;
