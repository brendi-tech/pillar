"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProductMutation } from "@/queries/v2/products.queries";
import type { AdminProduct } from "@/types/admin";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface EditProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: AdminProduct | null;
  onSuccess: () => void;
}

export function EditProductModal({
  open,
  onOpenChange,
  product,
  onSuccess,
}: EditProductModalProps) {
  const [name, setName] = useState("");

  // Sync input when the product changes or modal opens
  useEffect(() => {
    if (product) {
      setName(product.name);
    }
  }, [product]);

  const updateProduct = useMutation({
    ...updateProductMutation(),
    onSuccess: () => {
      toast.success("Assistant renamed");
      onSuccess();
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to rename assistant");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!product || !trimmed || trimmed === product.name) return;

    updateProduct.mutate({ id: product.id, data: { name: trimmed } });
  };

  const canSave = name.trim().length > 0 && name.trim() !== product?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Assistant</DialogTitle>
            <DialogDescription>
              Change the name of this assistant.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="product-name">Name</Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Assistant name"
              className="mt-1.5"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSave || updateProduct.isPending}
            >
              {updateProduct.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
