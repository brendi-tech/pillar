"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Activity, Database, Users } from "lucide-react";

interface UsageOverviewProps {
  usage: {
    apiCalls: { used: number; limit: number };
    storage: { used: number; limit: number };
    seats: { used: number; limit: number };
  };
}

export function UsageOverview({ usage }: UsageOverviewProps) {
  const apiPercent = (usage.apiCalls.used / usage.apiCalls.limit) * 100;
  const storagePercent = (usage.storage.used / usage.storage.limit) * 100;
  const seatsPercent = (usage.seats.used / usage.seats.limit) * 100;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Usage This Month</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* API Calls */}
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span>API Calls</span>
            </div>
            <span className="text-muted-foreground">
              {usage.apiCalls.used.toLocaleString()} /{" "}
              {usage.apiCalls.limit.toLocaleString()}
            </span>
          </div>
          <Progress value={apiPercent} className="h-2" />
        </div>

        {/* Storage */}
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Storage</span>
            </div>
            <span className="text-muted-foreground">
              {usage.storage.used} GB / {usage.storage.limit} GB
            </span>
          </div>
          <Progress value={storagePercent} className="h-2" />
        </div>

        {/* Seats */}
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Team Seats</span>
            </div>
            <span className="text-muted-foreground">
              {usage.seats.used} / {usage.seats.limit}
            </span>
          </div>
          <Progress value={seatsPercent} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
