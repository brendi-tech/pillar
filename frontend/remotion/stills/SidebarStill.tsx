import { AbsoluteFill } from "remotion";
import { DocsDesktopSidebar } from "@/components/Docs";
import { docsNavigation } from "@/lib/docs-navigation";
import { MockNextProvider } from "../mocks/NextMocks";

/**
 * Still composition for the documentation sidebar.
 * Renders the real DocsDesktopSidebar component with "Co-Pilot Chat" as the active page.
 */
export const SidebarStill: React.FC = () => {
  return (
    <MockNextProvider pathname="/docs/get-started/what-is-pillar">
      <AbsoluteFill
        style={{
          backgroundColor: "white",
          padding: 16,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <DocsDesktopSidebar navigation={docsNavigation} />
      </AbsoluteFill>
    </MockNextProvider>
  );
};
