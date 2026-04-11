"use client";

import { cn } from "@/lib/utils";
import { type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

/**
 * DetailDrawer — right-sliding detail panel for list-to-detail patterns.
 * Click a row in DataTable → DetailDrawer opens with full details, no page navigation.
 *
 * Usage:
 *   <DetailDrawer
 *     open={!!selectedOrder}
 *     onOpenChange={(open) => !open && setSelectedOrder(null)}
 *     title={selectedOrder?.id}
 *     description="Work Order Details"
 *     footer={<Button onClick={...}>Edit</Button>}
 *   >
 *     <div className="space-y-4">
 *       <MetricCard ... />
 *       <TimelineView ... />
 *     </div>
 *   </DetailDrawer>
 */

interface DetailDrawerProps {
  /** Controls open state */
  open: boolean;
  /** Called when the drawer should close */
  onOpenChange: (open: boolean) => void;
  /** Drawer title */
  title?: string;
  /** Optional description below title */
  description?: string;
  /** Footer slot — action buttons */
  footer?: ReactNode;
  /** Width class override. Default "sm:max-w-md". */
  width?: string;
  /** Content */
  children: ReactNode;
  className?: string;
}

export function DetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  footer,
  width = "sm:max-w-md",
  children,
  className,
}: DetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={cn(width, className)}>
        {(title || description) && (
          <SheetHeader>
            {title && <SheetTitle>{title}</SheetTitle>}
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {children}
        </div>

        {footer && (
          <SheetFooter>
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
