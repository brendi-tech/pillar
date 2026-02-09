import { cn } from "@/lib/utils";
import React from "react";

interface Props {
  className?: string;
  children: React.ReactNode;
}

export const NumberedHeading = ({ className, children }: Props) => {
  return (
    <p className={cn("font-mono py-1 px-2.5 capitalize text-xs", className)}>
      {children}
    </p>
  );
};
