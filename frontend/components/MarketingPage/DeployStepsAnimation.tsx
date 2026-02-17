"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useEffect, useRef, useState } from "react";
import { DashedConnector, DashedPathConnector } from "./DashedConnector";

const deploySteps = [
  { title: "Connect Your Knowledge", time: "~5min" },
  { title: "Create Actions", time: "~2hrs" },
  { title: "Embed in Your App", time: "~1hr" },
  { title: "Improve Over Time", time: "Ongoing" },
];

const STEP_DURATION = 3000;

const COLORS = {
  orange: "#FF6E00",
};

export const DeployStepsAnimation = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [hasStarted, setHasStarted] = useState(false);

  // Start the animation sequence when component comes into view
  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
          setActiveStepIndex(0);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [hasStarted]);

  // Progress through steps sequentially
  useEffect(() => {
    if (activeStepIndex >= 0 && activeStepIndex < deploySteps.length) {
      const timer = setTimeout(() => {
        setActiveStepIndex((prev) => prev + 1);
      }, STEP_DURATION);

      return () => clearTimeout(timer);
    }
  }, [activeStepIndex]);

  const getStepState = (index: number) => {
    if (index < activeStepIndex) return "completed";
    if (index === activeStepIndex) return "active";
    return "pending";
  };

  return (
    <div
      ref={ref}
      className="relative flex flex-col justify-center items-center w-[476px] max-600:w-full py-10 mx-auto"
    >
      {/* Top vertical line with dot */}
      <DashedConnector
        direction="vertical"
        length={24}
        startDot
        className="absolute right-[184px] top-[8px] max-600:hidden"
      />

      {/* Backward C connector */}
      <DashedPathConnector
        path="M 116 0 L 138 0 Q 148 0 148 10 L 148 145 Q 148 155 138 155 L 0 155"
        width={153}
        height={160}
        startDot
        startPosition={[116, 0]}
        endPosition={[0, 155]}
        className="absolute right-0 top-[60px] max-600:hidden"
      />
      {/* Regular C connector */}
      <DashedPathConnector
        path="M 36 0 L 10 0 Q 0 0 0 10 L 0 145 Q 0 155 10 155 L 148 155"
        width={153}
        height={160}
        startDot
        startPosition={[36, 0]}
        endPosition={[148, 155]}
        className="absolute left-[4px] top-[180px] max-600:hidden"
      />
      {/* Reverse L connector */}
      <DashedPathConnector
        path="M 51 0 L 51 63 Q 51 73 41 73 L 0 73"
        width={56}
        height={78}
        startDot
        startPosition={[51, 0]}
        endPosition={[0, 73]}
        className="absolute right-[184px] bottom-[72px] max-600:hidden"
      />

      {/* Bottom vertical line with dot */}
      <DashedConnector
        direction="vertical"
        length={24}
        endDot
        className="absolute left-[96px] bottom-[4px] max-600:hidden"
      />
      {deploySteps.map((step, index) => {
        const state = getStepState(index);
        const isEven = index % 2 === 0;
        const titleColor =
          state === "active"
            ? "text-[#FF6E00]"
            : state === "pending"
              ? "text-black/40"
              : "text-black";
        const textColor = state === "pending" ? "text-black/40" : "text-black";
        const isLast = index === deploySteps.length - 1;
        return (
          <div
            key={step.title}
            className={cn(
              "relative flex w-full max-w-[320px] max-600:max-w-[400px]",
              isEven
                ? "justify-start ml-auto max-600:ml-0"
                : "justify-end mr-auto max-600:mr-0",
              index > 0 && "mt-4",
              isLast && "translate-x-[-88px] max-600:translate-x-0",
              "max-600:justify-center"
            )}
          >
            {/* Card */}
            <Card className="w-[270px] max-600:w-full shadow-lg bg-[#F9F7F2]">
              <CardHeader className="pr-1 py-0 bg-[#F9F7F2]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className={cn("font-semibold text-sm transition-colors duration-300", titleColor)}>
                      {step.title}
                    </h3>
                  </div>
                  {/* Status icon - always reserve space to prevent layout shift */}
                  <div className="w-9 h-6 shrink-0 flex items-center justify-center">
                    {state === "completed" && (
                      <div className="w-9 h-6 rounded-[6px] bg-[#298F27]/6 flex items-center justify-center">
                        <Check className="w-4 h-4 text-[#298F27]" />
                      </div>
                    )}
                    {state === "active" && (
                      <div className="w-9 h-6 rounded-[6px] bg-[#FF6E00]/6 flex items-center justify-center">
                        <Spinner size="sm" className="text-[#FF6E00]" />
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>

              {/* Progress bar */}
              <CardContent className=" pt-2">
                <p className={cn("text-sm mt-1 pb-2 transition-colors duration-300", textColor)}>
                  {step.time}
                </p>
                <div className="h-1.5 w-full rounded-full bg-[#F3EFE8]">
                  <div
                    className="h-full rounded-full transition-all ease-linear"
                    style={{
                      backgroundColor: COLORS.orange,
                      width:
                        state === "completed"
                          ? "100%"
                          : state === "active"
                            ? "100%"
                            : "0%",
                      transitionDuration:
                        state === "active" ? `${STEP_DURATION}ms` : "0ms",
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
};
