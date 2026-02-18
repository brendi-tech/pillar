import { Composition } from "remotion";
import { HRDemo } from "./HRDemo";

export type Step = {
  activeText: string;
  completeText: string;
  detail?: string;
};

export type Layout = {
  contentWidth: number; // percentage (0-1)
  panelWidth: number; // percentage (0-1)
};

export type HRDemoProps = {
  query: string;
  responseText: string;
  steps: Step[];
  layout: Layout;
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
      id="HRDemo"
      component={HRDemo}
      durationInFrames={495} // 16.5 seconds at 30fps
      fps={30}
      width={DIMENSIONS.width}
      height={DIMENSIONS.height}
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
          layout: LAYOUT,
        } satisfies HRDemoProps
      }
    />
  );
};
