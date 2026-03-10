"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";

interface InvoicesCardProps {
  onManage: () => void;
  isPending: boolean;
}

export function InvoicesCard({ onManage, isPending }: InvoicesCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Invoices & Payment</CardTitle>
        <Button variant="outline" size="sm" onClick={onManage} disabled={isPending}>
          View in Stripe
          <ArrowUpRight className="ml-1 h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          View invoices, update payment methods, and manage your subscription in the
          Stripe Customer Portal.
        </p>
      </CardContent>
    </Card>
  );
}
