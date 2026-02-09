import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import type { ComponentProps } from "react";

interface SaveButtonProps extends Omit<
  ComponentProps<typeof Button>,
  "children"
> {
  isSaving?: boolean;
  label?: string;
}

export function SaveButton({
  isSaving = false,
  label = "Save",
  disabled,
  ...props
}: SaveButtonProps) {
  return (
    <Button disabled={disabled || isSaving} {...props}>
      {isSaving ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
