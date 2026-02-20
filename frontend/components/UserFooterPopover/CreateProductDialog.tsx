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
import { Spinner } from "@/components/ui/spinner";
import {
  createProductMutation,
  productKeys,
} from "@/queries/v2/products.queries";
import type { AdminProduct } from "@/types/admin";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  switchProduct: (id: string, product?: AdminProduct) => void;
}

export function CreateProductDialog({
  open,
  onOpenChange,
  switchProduct,
}: CreateProductDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [productName, setProductName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const createProduct = useMutation({
    ...createProductMutation(),
    onSuccess: (newProduct) => {
      // Add new product to cache immediately for instant UI update
      const allProductsKey = [...productKeys.all, "all-orgs"] as const;
      queryClient.setQueryData<AdminProduct[]>(allProductsKey, (old) =>
        old ? [...old, newProduct] : [newProduct]
      );

      // Invalidate to refetch fresh data in background
      queryClient.invalidateQueries({ queryKey: productKeys.all });

      // Pass the new product directly to avoid stale closure issue
      switchProduct(newProduct.id, newProduct);
      onOpenChange(false);
      setProductName("");
      router.push("/setup");
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      setProductName("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (productName.trim()) {
      createProduct.mutate({ name: productName.trim() });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
          className="sm:max-w-md"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
        <DialogHeader>
          <DialogTitle>Create New Assistant</DialogTitle>
          <DialogDescription>
            Enter a name for your new assistant.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                ref={inputRef}
                id="name"
                placeholder="My Assistant"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                disabled={createProduct.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createProduct.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!productName.trim() || createProduct.isPending}
            >
              {createProduct.isPending ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
