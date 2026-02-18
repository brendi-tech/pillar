import { Composition } from "remotion";
import { ProjectManagementDemo } from "./ProjectManagementDemo";

export type Step = {
  activeText: string;
  completeText: string;
  detail?: string;
};

export type Layout = {
  contentWidth: number; // percentage (0-1)
  panelWidth: number; // percentage (0-1)
};

export type ContextSnippet = {
  type: "error" | "code" | "text";
  title: string;
  content: string;
};

export type ProjectManagementDemoProps = {
  query: string;
  responseText: string;
  steps: Step[];
  layout: Layout;
  issueId: string;
  contextSnippet?: ContextSnippet;
};

// Layout constants - 65/35 split
export const LAYOUT = {
  contentWidth: 0.65, // 65%
  panelWidth: 0.35, // 35%
};

// Dimensions: 1920x1080 (16:9 aspect ratio for marketing)
export const DIMENSIONS = {
  width: 1920,
  height: 1080,
  contentPixelWidth: 1920 * LAYOUT.contentWidth, // 1248px
  panelPixelWidth: 1920 * LAYOUT.panelWidth, // 672px
};

export const RemotionRoot = () => {
  return (
    <Composition
      id="ProjectManagementDemo"
      component={ProjectManagementDemo}
      durationInFrames={540} // 18 seconds at 30fps
      fps={30}
      width={DIMENSIONS.width}
      height={DIMENSIONS.height}
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
          layout: LAYOUT,
        } satisfies ProjectManagementDemoProps
      }
    />
  );
};
