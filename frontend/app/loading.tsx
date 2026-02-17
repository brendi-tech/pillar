import { Spinner } from "@/components/ui/spinner";

/**
 * Root loading component - shown during route transitions.
 * This is used at the root level so it cannot depend on CustomerProvider.
 * The (public) routes have their own loading.tsx with the Header.
 */
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
      <Spinner size="xl" />
    </div>
  );
}
