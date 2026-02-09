import { Still } from "remotion";
import { SidebarStill } from "./stills/SidebarStill";
import { AskAIStill } from "./stills/AskAIStill";
import { EdgeTriggerStill } from "./stills/EdgeTriggerStill";
import { PanelHomeStill } from "./stills/PanelHomeStill";
import { PanelChatStill } from "./stills/PanelChatStill";
import { PanelPlanStill } from "./stills/PanelPlanStill";
import { ChatInputStill } from "./stills/ChatInputStill";
import { TextSelectionStill } from "./stills/TextSelectionStill";

// Import pre-compiled Tailwind v4 CSS (for docs components)
// Generated with: npx @tailwindcss/cli -i app/globals.css -o remotion/compiled-styles.css
import "./compiled-styles.css";

// Import SDK styles (for SDK preview components)
import "./sdk-styles/sdk-styles.css";

/**
 * Remotion Root component - registers all still compositions.
 *
 * Each Still defines:
 * - id: Used in CLI commands (e.g., `npx remotion still sidebar`)
 * - component: The React component to render
 * - width/height: Image dimensions in pixels
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ============================================
          Documentation Components (hc-frontend)
          ============================================ */}
      
      {/* Documentation sidebar */}
      <Still
        id="sidebar"
        component={SidebarStill}
        width={280}
        height={700}
      />

      {/* Ask AI button */}
      <Still
        id="ask-ai-button"
        component={AskAIStill}
        width={320}
        height={80}
      />

      {/* ============================================
          SDK Preview Components (packages/sdk)
          ============================================ */}
      
      {/* Edge trigger - Copilot button */}
      <Still
        id="edge-trigger"
        component={EdgeTriggerStill}
        width={48}
        height={120}
      />

      {/* Panel with home view (welcome + suggested questions) */}
      <Still
        id="panel-home"
        component={PanelHomeStill}
        width={380}
        height={580}
      />

      {/* Panel with chat thread (conversation) */}
      <Still
        id="panel-chat"
        component={PanelChatStill}
        width={380}
        height={560}
      />

      {/* Panel with Plan (multi-step workflow) - CRM example */}
      <Still
        id="panel-plan"
        component={PanelPlanStill}
        width={380}
        height={620}
      />

      {/* Chat input area with context tags */}
      <Still
        id="chat-input"
        component={ChatInputStill}
        width={380}
        height={180}
      />

      {/* Text selection "Ask AI" popover */}
      <Still
        id="text-selection"
        component={TextSelectionStill}
        width={420}
        height={100}
      />
    </>
  );
};
