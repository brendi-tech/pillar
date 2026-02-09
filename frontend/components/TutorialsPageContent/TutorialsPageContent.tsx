"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MOCK_TUTORIALS, type MockTutorial } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { BookOpen, Clock, Filter, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const difficultyConfig = {
  beginner: {
    label: "Beginner",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  intermediate: {
    label: "Intermediate",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  advanced: {
    label: "Advanced",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
};

type DifficultyFilter = "all" | "beginner" | "intermediate" | "advanced";

export function TutorialsPageContent() {
  const [filter, setFilter] = useState<DifficultyFilter>("all");

  const filteredTutorials =
    filter === "all"
      ? MOCK_TUTORIALS
      : MOCK_TUTORIALS.filter((t) => t.difficulty === filter);

  return (
    <main className="flex-1 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Tutorials</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Step-by-step guides to help you master the platform.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-8">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-2">
            Difficulty:
          </span>
          {(["all", "beginner", "intermediate", "advanced"] as const).map(
            (level) => (
              <Button
                key={level}
                variant={filter === level ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(level)}
                className="capitalize"
              >
                {level === "all" ? "All" : difficultyConfig[level].label}
              </Button>
            )
          )}
        </div>

        {/* Tutorial Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTutorials.map((tutorial) => (
            <TutorialCard key={tutorial.id} tutorial={tutorial} />
          ))}
        </div>

        {/* Empty state */}
        {filteredTutorials.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No tutorials found</h3>
            <p className="text-muted-foreground">
              Try adjusting your filters to see more tutorials.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function TutorialCard({ tutorial }: { tutorial: MockTutorial }) {
  const difficulty = difficultyConfig[tutorial.difficulty];

  return (
    <Link href={`/tutorials/${tutorial.slug}`}>
      <Card className="group h-full hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer">
        {/* Thumbnail - using img for external/dynamic URLs */}
        <div className="relative h-40 bg-muted overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              tutorial.thumbnail.startsWith("http")
                ? tutorial.thumbnail
                : `https://placehold.co/600x300/1a1a2e/ffffff?text=${encodeURIComponent(tutorial.title)}`
            }
            alt={tutorial.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* Difficulty badge */}
          <div className="absolute top-3 right-3">
            <Badge className={cn(difficulty.color)}>{difficulty.label}</Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
            {tutorial.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {tutorial.description}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {tutorial.estimatedTime}
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              {tutorial.steps.length} steps
            </span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mt-3">
            {tutorial.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </Card>
    </Link>
  );
}
