import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="text-center">
        <p className="text-4xl font-semibold">404</p>
        <p className="mt-2 text-xs text-muted-foreground">Page not found</p>
        <Button variant="outline" size="sm" className="mt-4" render={<Link href="/" />}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
