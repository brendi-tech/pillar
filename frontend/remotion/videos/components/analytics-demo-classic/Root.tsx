import { Composition } from "remotion";
import { AnalyticsDemo } from "./AnalyticsDemo";

export type Step = {
  activeText: string;
  completeText: string;
  detail?: string;
};

export type Layout = {
  contentWidth: number; // percentage (0-1)
  panelWidth: number; // percentage (0-1)
};

export type AnalyticsDemoProps = {
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
      id="AnalyticsDemo"
      component={AnalyticsDemo}
      durationInFrames={540} // 18 seconds at 30fps
      fps={30}
      width={DIMENSIONS.width}
      height={DIMENSIONS.height}
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
          layout: LAYOUT,
        } satisfies AnalyticsDemoProps
      }
    />
  );
};
