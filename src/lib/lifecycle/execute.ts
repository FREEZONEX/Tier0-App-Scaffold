import { transitionFor, type LifecycleDefinition, type LifecycleAction } from './index';

export interface LifecycleRecord<S extends string> { state: S; version: number }
export interface LifecycleExecution<S extends string, R extends LifecycleRecord<S>, Tx> {
  definition: LifecycleDefinition<S>;
  actionId: string;
  expectedVersion: number;
  /** Must be a real database transaction; failures roll back state, effects and audit. */
  transaction: <T>(run: (tx: Tx) => Promise<T>) => Promise<T>;
  load: (tx: Tx) => Promise<R>;
  /** Recheck authenticated actor permissions using the freshly loaded record. */
  authorize: (tx: Tx, record: R, permission: string) => Promise<boolean>;
  /** Throw when business prerequisites are not met. */
  validate: (tx: Tx, record: R, action: LifecycleAction<S>) => Promise<void>;
  /** Atomic UPDATE WHERE id AND state AND version, incrementing version. False = conflict. */
  compareAndSet: (tx: Tx, record: R, nextState: S) => Promise<boolean>;
  /** Transactional writes only. External effects must use an outbox in the same transaction. */
  apply: (tx: Tx, record: R, action: LifecycleAction<S>) => Promise<void>;
  /** Persist actor, action, from/to states, time and business identifier. */
  audit: (tx: Tx, record: R, action: LifecycleAction<S>) => Promise<void>;
}

/** Server service helper. Never expose callbacks or target states in an HTTP payload. */
export function executeLifecycleAction<S extends string, R extends LifecycleRecord<S>, Tx>(options: LifecycleExecution<S, R, Tx>) {
  return options.transaction(async tx => {
    const record = await options.load(tx);
    if (record.version !== options.expectedVersion) throw new Error('Record changed; reload before retrying');
    const action = transitionFor(options.definition, record.state, options.actionId);
    if (!await options.authorize(tx, record, action.permission)) throw new Error('Action forbidden');
    await options.validate(tx, record, action);
    if (!await options.compareAndSet(tx, record, action.to)) throw new Error('Concurrent action conflict');
    await options.apply(tx, record, action);
    await options.audit(tx, record, action);
    return { state: action.to, version: record.version + 1 };
  });
}
