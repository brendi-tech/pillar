import { continueRender, delayRender } from "remotion";

const fontWaitHandle = delayRender("Loading Geist fonts");

const link = document.createElement("link");
link.rel = "stylesheet";
link.href =
  "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600;700&display=swap";
document.head.appendChild(link);

const fontTimeout = setTimeout(() => continueRender(fontWaitHandle), 8000);
document.fonts.ready.then(() => {
  clearTimeout(fontTimeout);
  continueRender(fontWaitHandle);
});

export const FONT = '"Geist", system-ui, sans-serif';
export const MONO_FONT = '"Geist Mono", "SF Mono", monospace';
