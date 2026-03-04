import { Skeleton } from "@/components/ui/skeleton";

export function ToolsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-4" />
          </div>
          <div className="ml-4 space-y-1">
            {[...Array(2)].map((_, j) => (
              <div key={j} className="flex items-center gap-2 px-3 py-1.5">
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
