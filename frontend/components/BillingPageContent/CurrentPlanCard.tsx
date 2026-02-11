"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";

interface CurrentPlanCardProps {
  plan: {
    name: string;
    price: number;
    billingCycle: "monthly" | "annual";
    nextBillingDate: string;
  };
}

export function CurrentPlanCard({ plan }: CurrentPlanCardProps) {
  const formattedDate = format(parseISO(plan.nextBillingDate), "MMMM d, yyyy");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-2xl font-bold">{plan.name}</span>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" />
            Active
          </Badge>
        </div>
        <div className="text-3xl font-bold">
          ${plan.price}
          <span className="text-sm font-normal text-muted-foreground">
            /{plan.billingCycle === "monthly" ? "mo" : "yr"}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Next billing date: {formattedDate}
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm">
            Change Plan
          </Button>
          <Button variant="ghost" size="sm">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
