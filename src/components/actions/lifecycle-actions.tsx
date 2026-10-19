"use client";
import { Button } from '@/components/ui/button';
import type { ActionAvailability } from '@/lib/lifecycle';

/** Supply server-evaluated actions, omitting unauthorized ones. Refresh after success.
 * onAction owns confirmation, errors, pending state and the authenticated action request.
 * This component never calculates or writes a target state.
 */
export function LifecycleActions({ actions, pending = false, onAction }: {
  actions: readonly ActionAvailability[];
  pending?: boolean;
  onAction: (actionId: string) => void;
}) {
  return <div className="flex flex-wrap gap-2">
    {actions.map(action => <div key={action.id} className="flex flex-col gap-1">
      <Button type="button" variant="outline" disabled={pending || !action.allowed}
        onClick={() => onAction(action.id)}>{action.label}</Button>
      {!action.allowed && action.reason && <span className="text-xs text-muted-foreground">{action.reason}</span>}
    </div>)}
  </div>;
}
