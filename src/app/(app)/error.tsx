"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="text-center">
        <p className="text-sm font-medium text-destructive">Something went wrong</p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
