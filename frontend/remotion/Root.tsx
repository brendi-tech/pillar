import { Composition, Still } from "remotion";
import { SidebarStill } from "./stills/SidebarStill";
import { AskAIStill } from "./stills/AskAIStill";
import { EdgeTriggerStill } from "./stills/EdgeTriggerStill";
import { PanelHomeStill } from "./stills/PanelHomeStill";
import { PanelChatStill } from "./stills/PanelChatStill";
import { PanelPlanStill } from "./stills/PanelPlanStill";
import { ChatInputStill } from "./stills/ChatInputStill";
import { TextSelectionStill } from "./stills/TextSelectionStill";
import { DemoComposition } from "./videos/DemoComposition";
import { WireframeComposition } from "./videos/WireframeComposition";
import {
  BankingDemoClassic,
  LAYOUT,
  DIMENSIONS,
} from "./videos/components/banking-demo-classic";
import type { BankingDemoClassicProps } from "./videos/components/banking-demo-classic";
import {
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  VIDEO_FPS,
  WIREFRAME_WIDTH,
  WIREFRAME_HEIGHT,
} from "./videos/constants";
import { getTotalDurationFrames } from "./videos/timing";
import { bankingDemo } from "./videos/data/banking";
import { crmDemo } from "./videos/data/crm";
import { analyticsDemo } from "./videos/data/analytics";
import { pmDemo } from "./videos/data/pm";
import { hrDemo } from "./videos/data/hr";
import type { DemoConfig } from "./videos/types";

// Import pre-compiled Tailwind v4 CSS (for docs components)
// Generated with: npx @tailwindcss/cli -i app/globals.css -o remotion/compiled-styles.css
import "./compiled-styles.css";

// Import SDK styles (for SDK preview components)
import "./sdk-styles/sdk-styles.css";

/** Demo configs keyed by ID */
const DEMO_CONFIGS: Record<string, DemoConfig> = {
  banking: bankingDemo,
  crm: crmDemo,
  analytics: analyticsDemo,
  pm: pmDemo,
  hr: hrDemo,
};

const DEMO_IDS = Object.keys(DEMO_CONFIGS);

/**
 * Remotion Root component - registers all still and video compositions.
 *
 * Stills:
 * - id: Used in CLI commands (e.g., `npx remotion still sidebar`)
 * - component: The React component to render
 * - width/height: Image dimensions in pixels
 *
 * Videos (technical demo compositions):
 * - id: demo-{demoId} (e.g., `npx remotion render demo-banking`)
 * - 1920x1080 at 30fps, 18 seconds
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ============================================
          Documentation Components (frontend)
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

      {/* ============================================
          Classic Banking Demo (full Apex Bank mockup)
          ============================================ */}

      <Composition
        id="BankingDemoClassic"
        component={BankingDemoClassic}
        durationInFrames={840}
        fps={30}
        width={DIMENSIONS.width}
        height={DIMENSIONS.height}
        defaultProps={
          {
            query: "Pay my cleaners $200",
            responseText:
              "All set! Your payment of $200.00 to Sarah Chen is ready. Just hit Confirm to send it.",
            steps: [
              {
                text: "Looking up 'cleaner' in saved payees...",
                techBadge: "GET /api/payees?q=cleaner",
              },
              {
                text: "Found match: Sarah Chen",
                techBadge: "payee_id: 7823",
              },
              {
                text: "Opening payment screen...",
                techBadge: "navigate → /payments/new",
              },
              {
                text: "Pre-filling with recipient data...",
                techBadge: "data: { payee, amount, account }",
              },
              {
                text: "Ready for confirmation",
                techBadge: "awaiting_user_confirm",
              },
            ],
            layout: LAYOUT,
            accentColor: "#3B82F6",
          } satisfies BankingDemoClassicProps
        }
      />

      {/* ============================================
          Technical Demo Video Compositions
          ============================================ */}

      {DEMO_IDS.map((demoId) => (
        <Composition
          key={demoId}
          id={`demo-${demoId}`}
          component={DemoComposition}
          durationInFrames={getTotalDurationFrames(DEMO_CONFIGS[demoId].steps)}
          fps={VIDEO_FPS}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
          defaultProps={{ demoId }}
        />
      ))}

      {/* ============================================
          Wireframe-only Video Compositions (square)
          Used with hybrid React+video layout
          ============================================ */}

      {DEMO_IDS.map((demoId) => (
        <Composition
          key={`wireframe-${demoId}`}
          id={`wireframe-${demoId}`}
          component={WireframeComposition}
          durationInFrames={getTotalDurationFrames(DEMO_CONFIGS[demoId].steps)}
          fps={VIDEO_FPS}
          width={WIREFRAME_WIDTH}
          height={WIREFRAME_HEIGHT}
          defaultProps={{ demoId }}
        />
      ))}
    </>
  );
};
