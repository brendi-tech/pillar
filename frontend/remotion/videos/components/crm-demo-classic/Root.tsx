import { Composition } from "remotion";
import { CRMDemo } from "./CRMDemo";

export type Step = {
  activeText: string;
  completeText: string;
  detail?: string;
};

export type Layout = {
  crmWidth: number; // percentage (0-1)
  panelWidth: number; // percentage (0-1)
};

export type CRMDemoProps = {
  query: string;
  responseText: string;
  steps: Step[];
  layout: Layout;
};

// Layout constants - narrower panel (35%)
export const LAYOUT = {
  crmWidth: 0.65, // 65%
  panelWidth: 0.35, // 35%
};

// Dimensions: 1920x1080 (16:9 aspect ratio for marketing)
export const DIMENSIONS = {
  width: 1920,
  height: 1080,
  crmPixelWidth: 1920 * LAYOUT.crmWidth, // 1190px
  panelPixelWidth: 1920 * LAYOUT.panelWidth, // 730px
};

export const RemotionRoot = () => {
  return (
    <Composition
      id="CRMDemo"
      component={CRMDemo}
      durationInFrames={544} // ~18.1 seconds at 30fps
      fps={30}
      width={DIMENSIONS.width}
      height={DIMENSIONS.height}
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
          layout: LAYOUT,
        } satisfies CRMDemoProps
      }
    />
  );
};
