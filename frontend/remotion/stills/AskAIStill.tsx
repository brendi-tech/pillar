import { AbsoluteFill } from "remotion";
import { DocsAskAI } from "@/components/Docs";
import { MockPillarProvider } from "../mocks/PillarMocks";

/**
 * Still composition for the "Ask AI about this page" button.
 * Renders the real DocsAskAI component centered in the frame.
 */
export const AskAIStill: React.FC = () => {
  return (
    <MockPillarProvider>
      <AbsoluteFill
        style={{
          backgroundColor: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <DocsAskAI />
      </AbsoluteFill>
    </MockPillarProvider>
  );
};
