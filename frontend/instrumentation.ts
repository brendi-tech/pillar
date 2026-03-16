export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV === "production") {
      const { patchConsole } = await import("./lib/logger");
      patchConsole();
    }
  }
}
