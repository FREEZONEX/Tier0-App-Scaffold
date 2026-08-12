import { APP_ICON, APP_NAME } from "@/lib/app-chrome";
import { cn } from "@/lib/utils";

export function AppBrandIcon({ className }: { className?: string }) {
  if (typeof APP_ICON === "string") {
    return (
      <img
        src={APP_ICON}
        alt={`${APP_NAME} icon`}
        className={cn("size-full rounded-[inherit] object-cover", className)}
      />
    );
  }

  const Icon = APP_ICON;
  return (
    <Icon
      aria-hidden="true"
      className={cn("size-5", className)}
      strokeWidth={1.8}
    />
  );
}
