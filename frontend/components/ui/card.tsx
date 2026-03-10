import * as React from "react";

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const cardVariants = cva(
  "text-card-foreground flex flex-col overflow-hidden has-data-[slot=card-header]:pt-0",
  {
    variants: {
      variant: {
        default:
          "bg-card-header border-card-border rounded-[10px] border shadow-sm",
        flat: "bg-muted/40 rounded-[10px]",
        ghost: "",
        outline: "rounded-[10px] border border-border bg-background",
        elevated: "rounded-[10px] bg-background shadow-md",
      },
    },
    defaultVariants: {
      variant: "ghost",
    },
  }
);

const cardHeaderVariants = cva(
  "@container/card-header grid min-h-9 items-center px-4 pt-2.5 pb-2 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6 shrink-0",
  {
    variants: {
      variant: {
        default: "bg-card-header",
        flat: "pb-4",
        ghost: "px-0 pb-4",
        outline: "pb-4",
        elevated: "pb-2 border-b border-border",
      },
    },
    defaultVariants: {
      variant: "ghost",
    },
  }
);

const cardTitleVariants = cva("leading-none font-medium", {
  variants: {
    variant: {
      default:
        "text-card-header-foreground/50 font-mono text-[11px] uppercase",
      flat: "text-foreground text-sm",
      ghost: "text-foreground text-sm",
      outline: "text-foreground text-sm",
      elevated: "text-foreground text-sm",
    },
  },
  defaultVariants: {
    variant: "ghost",
  },
});

const cardDescriptionVariants = cva("pt-1 text-xs", {
  variants: {
    variant: {
      default: "text-card-header-foreground/50",
      flat: "text-muted-foreground",
      ghost: "text-muted-foreground",
      outline: "text-muted-foreground",
      elevated: "text-muted-foreground",
    },
  },
  defaultVariants: {
    variant: "ghost",
  },
});

const cardContentVariants = cva("p-4 h-full", {
  variants: {
    variant: {
      default: "bg-background border-card-border rounded-t-[8px] border-t",
      flat: "pt-0",
      ghost: "px-0 pt-0",
      outline: "pt-0",
      elevated: "pt-4",
    },
  },
  defaultVariants: {
    variant: "ghost",
  },
});

const cardFooterVariants = cva("flex items-center px-4 [.border-t]:pt-4", {
  variants: {
    variant: {
      default: "bg-background",
      flat: "",
      ghost: "px-0",
      outline: "",
      elevated: "",
    },
  },
  defaultVariants: {
    variant: "ghost",
  },
});

type CardVariant = "default" | "flat" | "ghost" | "outline" | "elevated";

const CardVariantContext = React.createContext<CardVariant>("ghost");

function Card({
  className,
  variant = "ghost",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <CardVariantContext.Provider value={variant ?? "ghost"}>
      <div
        data-slot="card"
        className={cn(cardVariants({ variant }), className)}
        {...props}
      />
    </CardVariantContext.Provider>
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  const variant = React.useContext(CardVariantContext);
  return (
    <div
      data-slot="card-header"
      className={cn(cardHeaderVariants({ variant }), className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  const variant = React.useContext(CardVariantContext);
  return (
    <p
      data-slot="card-title"
      className={cn(cardTitleVariants({ variant }), className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  const variant = React.useContext(CardVariantContext);
  return (
    <div
      data-slot="card-description"
      className={cn(cardDescriptionVariants({ variant }), className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  const variant = React.useContext(CardVariantContext);
  return (
    <div
      data-slot="card-content"
      className={cn(cardContentVariants({ variant }), className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  const variant = React.useContext(CardVariantContext);
  return (
    <div
      data-slot="card-footer"
      className={cn(cardFooterVariants({ variant }), className)}
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
