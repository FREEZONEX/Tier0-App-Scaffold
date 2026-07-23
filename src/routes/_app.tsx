/**
 * Pathless layout wrapping "/". This SCADA product branch's single primary
 * workflow (the HMI page, see _app.index.tsx) owns "/" through this slot
 * instead of the generic scaffold Shell — no sidebar, no nested workspace
 * pages, so this layout stays a plain pass-through.
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app")({
  component: () => <Outlet />,
});
