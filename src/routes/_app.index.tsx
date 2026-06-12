import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({
  component: TemplateBlankHome,
});

/**
 * TEMPLATE_BLANK_ROUTE
 *
 * This is the scaffold's only intentionally blank route. Generated apps must
 * replace it with a real home/dashboard, redirect it to the selected app
 * entry, or make the single primary workflow own `/` directly.
 */
function TemplateBlankHome() {
  return <div className="min-h-full bg-background" aria-hidden="true" />;
}
