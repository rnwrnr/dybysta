"use client";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border !border-border !bg-card !text-foreground !shadow-xl !shadow-black/5 !text-[14.5px]",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground !rounded-md",
          cancelButton: "!bg-muted !text-foreground !rounded-md",
        },
      }}
      {...props}
    />
  );
}
