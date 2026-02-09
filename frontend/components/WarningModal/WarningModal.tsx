import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface WarningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  variant?: "default" | "delete";
  isLoading?: boolean;
  confirmText?: string;
  cancelText?: string;
}

export function WarningModal({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  variant = "default",
  isLoading = false,
  confirmText,
  cancelText = "Cancel",
}: WarningModalProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  const defaultConfirmText = variant === "delete" ? "Delete" : "Continue";
  const confirmButtonVariant = variant === "delete" ? "destructive" : "default";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-muted-foreground text-sm">{description}</div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={confirmButtonVariant}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : (confirmText ?? defaultConfirmText)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
