let forceLogoutCallback: (() => void) | null = null;

export function registerForceLogout(cb: () => void) {
  forceLogoutCallback = cb;
}

export function triggerForceLogout() {
  forceLogoutCallback?.();
}
