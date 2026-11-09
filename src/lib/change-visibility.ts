/**
 * Which record changes a user's browser may hear about over
 * `/api/uns/subscribe` (`useRecordChanges`).
 *
 * Agent: adapt this to the App's role rules. The platform does not narrow
 * the App's data by user: the change stream runs as the App and sees every
 * change of the App's collections. A change event carries no record data,
 * only the collection alias, the record ID, its revision and the kind of
 * change, but a record ID can still tell a user that a record exists. Return
 * false for changes the user must not learn about, using the same rules the
 * App's services apply when that user reads the collection, for example:
 *
 *   if (change.collection === "salaries") return can(user.roles, "view_salaries");
 *
 * It runs synchronously for every change and every connected browser: decide
 * from the user and the change alone, never read records here. A function
 * that throws drops the change.
 */
import type { RecordChange } from "@tier0/sdk-v2/data";
import type { AppUser } from "./users";

export function canSeeChange(_user: AppUser, _change: RecordChange): boolean {
  return true;
}
