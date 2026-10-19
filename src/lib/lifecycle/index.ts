/** Pure definitions shared by server services and presentation. No client authority. */
export interface LifecycleAction<S extends string> {
  id: string;
  label: string;
  from: readonly S[];
  to: S;
  permission: string;
}
export interface LifecycleDefinition<S extends string> {
  initial: S;
  actions: readonly LifecycleAction<S>[];
}
export interface ActionAvailability {
  id: string;
  label: string;
  allowed: boolean;
  reason?: string;
}

/** Ordinary create/update payloads must omit ALL server-owned state fields. */
export function assertNoManagedState(payload: Record<string, unknown>, fields: readonly string[]) {
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      throw new Error(`Server-managed field cannot be written: ${field}`);
    }
  }
}

export function transitionFor<S extends string>(definition: LifecycleDefinition<S>, state: S, actionId: string) {
  const action = definition.actions.find(item => item.id === actionId);
  if (!action || !action.from.includes(state)) throw new Error('Action unavailable in current state');
  return action;
}
