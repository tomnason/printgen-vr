// Small shared VR logging helper so we can call vrLog from multiple modules
export function vrLog(message: string) {
  try {
    const logDiv = document.getElementById('vrConsole');
    if (logDiv) {
      const entry = document.createElement('div');
      entry.textContent = message;
      logDiv.appendChild(entry);
      logDiv.scrollTop = logDiv.scrollHeight;
    }
  } catch (_) {
    // ignore DOM errors when running in non-browser test environments
  }
  // Always emit to the regular console too for desktop debugging
  console.log(message);
}
