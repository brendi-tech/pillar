import { Spinner } from "@/components/ui/spinner";

/**
 * Full screen loading spinner component.
 * Used for auth loading states and other full-page loading scenarios.
 */
export function FullScreenLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-(--hc-background)">
      <Spinner size="lg" />
    </div>
  );
}
