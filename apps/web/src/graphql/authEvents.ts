let forceLogoutCallback: (() => void) | null = null;

export function registerForceLogout(cb: () => void) {
  forceLogoutCallback = cb;
}

export function triggerForceLogout() {
  forceLogoutCallback?.();
}

let unverifiedPromptCallback: (() => void) | null = null;

export function registerUnverifiedPrompt(cb: () => void) {
  unverifiedPromptCallback = cb;
}

export function triggerUnverifiedPrompt() {
  unverifiedPromptCallback?.();
}
