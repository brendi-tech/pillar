"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { agentScoreAPI } from "@/lib/public/agent-score-api";

interface SessionReplayProps {
  reportId: string;
  instruction?: string;
}

export function SessionReplay({ reportId, instruction }: SessionReplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<unknown>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptExpanded, setPromptExpanded] = useState(false);

  const initPlayer = useCallback(async () => {
    if (!containerRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const events = await agentScoreAPI.getRecording(reportId);

      if (!events || !Array.isArray(events) || events.length === 0) {
        setError("No recording data available.");
        return;
      }

      // Dynamically import rrweb-player (it needs DOM access)
      const rrwebPlayer = (await import("rrweb-player")).default;
      await import("rrweb-player/dist/style.css");

      // Clear any previous player
      containerRef.current.innerHTML = "";

      playerRef.current = new rrwebPlayer({
        target: containerRef.current,
        props: {
          events,
          width: 900,
          height: 560,
          autoPlay: false,
          showController: true,
          speedOption: [1, 2, 4, 8],
        },
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to load recording.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  // Initialize the player when the dialog opens
  useEffect(() => {
    if (open) {
      // Small delay to let the dialog DOM render
      const timer = setTimeout(initPlayer, 100);
      return () => clearTimeout(timer);
    }
    // Clean up player when dialog closes
    playerRef.current = null;
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
  }, [open, initPlayer]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-[#FF6E00] hover:text-[#E06200] transition-colors cursor-pointer"
        >
          <Play className="h-3.5 w-3.5" />
          Watch the session recording
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[960px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>Signup Test Recording</DialogTitle>
          <DialogDescription>
            Replay of the AI agent attempting to sign up on your site.
          </DialogDescription>
        </DialogHeader>

        {instruction && (
          <div className="px-6 pt-2">
            <button
              type="button"
              onClick={() => setPromptExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors cursor-pointer"
            >
              {promptExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Stagehand prompt
            </button>
            {promptExpanded && (
              <pre className="mt-2 rounded-lg bg-[#F9F7F3] border border-[#E8E4DC] p-4 text-xs text-[#4A4A4A] leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto font-mono">
                {instruction}
              </pre>
            )}
          </div>
        )}

        <div className="px-6 pb-6">
          {loading && (
            <div className="flex items-center justify-center h-[560px]">
              <Loader2 className="h-8 w-8 animate-spin text-[#6B6B6B]" />
              <span className="ml-3 text-sm text-[#6B6B6B]">
                Loading recording...
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-[560px]">
              <p className="text-sm text-[#FF4E42]">{error}</p>
            </div>
          )}

          <div
            ref={containerRef}
            className={loading || error ? "hidden" : ""}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
