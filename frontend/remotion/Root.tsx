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
import { CRMDemo } from "./videos/components/crm-demo-classic/CRMDemo";
import type { CRMDemoProps } from "./videos/components/crm-demo-classic/Root";
import { LAYOUT as CRM_LAYOUT, DIMENSIONS as CRM_DIMENSIONS } from "./videos/components/crm-demo-classic/Root";
import { AnalyticsDemo } from "./videos/components/analytics-demo-classic/AnalyticsDemo";
import type { AnalyticsDemoProps } from "./videos/components/analytics-demo-classic/Root";
import { LAYOUT as ANALYTICS_LAYOUT, DIMENSIONS as ANALYTICS_DIMENSIONS } from "./videos/components/analytics-demo-classic/Root";
import { ProjectManagementDemo } from "./videos/components/pm-demo-classic/ProjectManagementDemo";
import type { ProjectManagementDemoProps } from "./videos/components/pm-demo-classic/Root";
import { LAYOUT as PM_LAYOUT, DIMENSIONS as PM_DIMENSIONS } from "./videos/components/pm-demo-classic/Root";
import { HRDemo } from "./videos/components/hr-demo-classic/HRDemo";
import type { HRDemoProps } from "./videos/components/hr-demo-classic/Root";
import { LAYOUT as HR_LAYOUT, DIMENSIONS as HR_DIMENSIONS } from "./videos/components/hr-demo-classic/Root";
import {
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  VIDEO_FPS,
  WIREFRAME_WIDTH,
  WIREFRAME_HEIGHT,
} from "./videos/constants";
import {
  ChangelogFlood,
  CHANGELOG_DIMENSIONS,
  CHANGELOG_DURATION,
  ArchitectureDiagram,
  ARCHITECTURE_DIMENSIONS,
  ARCHITECTURE_DURATION,
} from "./videos/components/launch-overlays";
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
                text: "Found match: Sarah Chen",
                techBadge: "GET /api/payees?q=cleaner",
              },
              {
                text: "Opened payment screen",
                techBadge: "navigate → /payments/new",
              },
              {
                text: "Pre-filled $200 to Sarah Chen",
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
          Classic Banking Demo (no logos)
          ============================================ */}

      <Composition
        id="BankingDemoClassicNoLogos"
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
                text: "Found match: Sarah Chen",
                techBadge: "GET /api/payees?q=cleaner",
              },
              {
                text: "Opened payment screen",
                techBadge: "navigate → /payments/new",
              },
              {
                text: "Pre-filled $200 to Sarah Chen",
                techBadge: "data: { payee, amount, account }",
              },
              {
                text: "Ready for confirmation",
                techBadge: "awaiting_user_confirm",
              },
            ],
            layout: LAYOUT,
            accentColor: "#3B82F6",
            showLogos: false,
          } satisfies BankingDemoClassicProps
        }
      />

      {/* ============================================
          Classic CRM Demo
          ============================================ */}

      <Composition
        id="CRMDemoClassic"
        component={CRMDemo}
        durationInFrames={544}
        fps={30}
        width={CRM_DIMENSIONS.width}
        height={CRM_DIMENSIONS.height}
        defaultProps={
          {
            query: "Set the Walmart deal as won and notify implementation that it's been signed",
            responseText:
              "Done! Walmart deal set to Closed Won. Implementation team has been notified.",
            steps: [
              { activeText: "Searching for Walmart deal...", completeText: "Found: Walmart - Enterprise ($2.4M)" },
              { activeText: "Setting stage to Closed Won...", completeText: "Deal marked as Closed Won" },
              { activeText: "Opening implementation handoff...", completeText: "Opened handoff form" },
              { activeText: "Notifying implementation team...", completeText: "Implementation team notified" },
            ],
            layout: CRM_LAYOUT,
          } satisfies CRMDemoProps
        }
      />

      {/* ============================================
          Classic Analytics Demo
          ============================================ */}

      <Composition
        id="AnalyticsDemoClassic"
        component={AnalyticsDemo}
        durationInFrames={540}
        fps={30}
        width={ANALYTICS_DIMENSIONS.width}
        height={ANALYTICS_DIMENSIONS.height}
        defaultProps={
          {
            query: "Add a weekly signups chart to my dashboard",
            responseText:
              "Done! I've added a weekly signups chart to your dashboard. The chart shows signup trends over the past 12 weeks.",
            steps: [
              { activeText: "Listing available data sets...", completeText: "Found 47 datasets" },
              { activeText: "Writing SQL query...", completeText: "Query ready: weekly signups" },
              { activeText: "Executing query...", completeText: "12 rows returned" },
              { activeText: "Saving chart to dashboard...", completeText: "Chart added to dashboard" },
            ],
            layout: ANALYTICS_LAYOUT,
          } satisfies AnalyticsDemoProps
        }
      />

      {/* ============================================
          Classic PM Demo
          ============================================ */}

      <Composition
        id="PMDemoClassic"
        component={ProjectManagementDemo}
        durationInFrames={540}
        fps={30}
        width={PM_DIMENSIONS.width}
        height={PM_DIMENSIONS.height}
        defaultProps={
          {
            query: "Create a P1 bug for this and add it to the current sprint",
            responseText:
              "Done! Created P1 bug 'Checkout crash on payment confirmation' and added it to Sprint 23.",
            issueId: "LIN-1234",
            contextSnippet: {
              type: "error",
              title: "Slack: #eng-alerts",
              content: "TypeError: Cannot read property 'id' of undefined\n  at CheckoutPage.confirmPayment (checkout.ts:142)",
            },
            steps: [
              { activeText: "Opening new issue form...", completeText: "Issue form opened" },
              { activeText: "Setting type and priority...", completeText: "Set to Bug, P1" },
              { activeText: "Pre-filling from error context...", completeText: "Title: Checkout crash on payment confirmation" },
              { activeText: "Adding to current cycle...", completeText: "Added to Sprint 23" },
            ],
            layout: PM_LAYOUT,
          } satisfies ProjectManagementDemoProps
        }
      />

      {/* ============================================
          Classic HR Demo
          ============================================ */}

      <Composition
        id="HRDemoClassic"
        component={HRDemo}
        durationInFrames={495}
        fps={30}
        width={HR_DIMENSIONS.width}
        height={HR_DIMENSIONS.height}
        defaultProps={
          {
            query: "How do I change my direct deposit?",
            responseText:
              "I've opened the Direct Deposit form for you. Enter your new bank details in the highlighted fields, then click Save to update your payment method.",
            steps: [
              { activeText: "Navigating to Payroll settings...", completeText: "Opened Payroll settings" },
              { activeText: "Finding Direct Deposit section...", completeText: "Found Direct Deposit" },
              { activeText: "Opening edit form...", completeText: "Ready for your new bank details" },
            ],
            layout: HR_LAYOUT,
          } satisfies HRDemoProps
        }
      />

      {/* ============================================
          Launch Video Overlays
          ============================================ */}

      <Composition
        id="ChangelogFlood"
        component={ChangelogFlood}
        durationInFrames={CHANGELOG_DURATION}
        fps={30}
        width={CHANGELOG_DIMENSIONS.width}
        height={CHANGELOG_DIMENSIONS.height}
      />

      <Composition
        id="ArchitectureDiagram"
        component={ArchitectureDiagram}
        durationInFrames={ARCHITECTURE_DURATION}
        fps={30}
        width={ARCHITECTURE_DIMENSIONS.width}
        height={ARCHITECTURE_DIMENSIONS.height}
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
