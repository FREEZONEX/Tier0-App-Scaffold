import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({
  component: TemplateBlankHome,
});

/**
 * TEMPLATE_BLANK_ROUTE
 *
 * This is the scaffold's only intentionally blank route. Generated apps must
 * replace it with a requested home page, redirect it to the selected app entry,
 * or make the single primary workflow own `/` directly. Do not create an
 * overview/dashboard page unless the product requirements call for one.
 */
function TemplateBlankHome() {
  return <div className="min-h-full bg-background" aria-hidden="true" />;
}
