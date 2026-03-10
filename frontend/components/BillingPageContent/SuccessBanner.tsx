"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2 } from "lucide-react";

interface SuccessBannerProps {
  isVerifying: boolean;
}

export function SuccessBanner({ isVerifying }: SuccessBannerProps) {
  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardContent className="flex items-center gap-3 py-4">
        {isVerifying ? (
          <>
            <Spinner size="sm" />
            <p className="text-sm text-muted-foreground">
              Confirming your subscription...
            </p>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                Subscription activated
              </p>
              <p className="text-sm text-muted-foreground">
                Your plan is now active. You can start using Pillar right away.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
