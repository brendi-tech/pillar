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
      <CardHeader>
        <CardTitle>Usage This Month</CardTitle>
      </CardHeader>
      <CardContent className="@container space-y-4">
        {/* API Calls */}
        <div>
          <div className="mb-1 flex items-center justify-between text-sm @[0px]:flex-col @[0px]:items-start @[260px]:flex-row @[260px]:items-center">
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
          <div className="mb-1 flex items-center justify-between text-sm @[0px]:flex-col @[0px]:items-start @[260px]:flex-row @[260px]:items-center">
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
          <div className="mb-1 flex items-center justify-between text-sm @[0px]:flex-col @[0px]:items-start @[260px]:flex-row @[260px]:items-center">
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
