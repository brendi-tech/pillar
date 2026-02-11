"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { format, parseISO } from "date-fns";

// Mock invoice data
const mockInvoices = [
  {
    id: "INV-2026-001",
    date: "2026-01-20",
    amount: 99,
    status: "paid" as const,
  },
  {
    id: "INV-2025-012",
    date: "2025-12-20",
    amount: 99,
    status: "paid" as const,
  },
  {
    id: "INV-2025-011",
    date: "2025-11-20",
    amount: 99,
    status: "paid" as const,
  },
  {
    id: "INV-2025-010",
    date: "2025-10-20",
    amount: 99,
    status: "paid" as const,
  },
  {
    id: "INV-2025-009",
    date: "2025-09-20",
    amount: 79,
    status: "paid" as const,
  },
];

export function InvoiceHistory() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice History</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockInvoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.id}</TableCell>
                <TableCell>
                  {format(parseISO(invoice.date), "MMM d, yyyy")}
                </TableCell>
                <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={
                      invoice.status === "paid"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-amber-500/20 bg-amber-500/10 text-amber-600"
                    }
                  >
                    {invoice.status === "paid" ? "Paid" : "Pending"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
