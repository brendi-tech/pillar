/**
 * SourcesCardOpenAi - Business logic wrapper for ChatGPT integration
 * Uses the presentational SourcesCard component with window.openai hooks
 */
import { SourcesCard } from "./SourcesCard";
import { useTheme, useToolOutput } from "./hooks";
import { SourcesToolOutput } from "./types";

/**
 * SourcesCard wrapper for ChatGPT/OpenAI environments
 * Automatically fetches sources and theme from window.openai
 */
export function SourcesCardOpenAi() {
  // Get data from window.openai
  const toolOutput = useToolOutput<SourcesToolOutput>();
  const theme = useTheme();

  const sources = toolOutput?.sources;

  if (!sources || sources.length === 0) {
    return null;
  }

  return <SourcesCard sources={sources} theme={theme} />;
}

export default SourcesCardOpenAi;
