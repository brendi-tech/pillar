"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ApiKeysCard } from "@/components/PillarCards/ApiKeysCard";
import { useApiKeysModal } from "./useApiKeysModal";

export function ApiKeysModal() {
  const { isOpen, data, close } = useApiKeysModal();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>API Keys</DialogTitle>
          <DialogDescription>
            Create and manage API keys for this project.
          </DialogDescription>
        </DialogHeader>
        {isOpen && (
          <ApiKeysCard
            data={data ?? {}}
            onConfirm={() => close()}
            onCancel={() => close()}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
