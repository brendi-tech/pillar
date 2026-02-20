"use client";

import { CreditCard } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export function BillingPageContent() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-muted p-3">
          <CreditCard className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">Billing coming soon</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          We&apos;re still setting up billing. In the meantime, enjoy full
          access to Pillar — no payment required.
        </p>
      </CardContent>
    </Card>
  );
}
