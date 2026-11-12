import { DataError } from "@/lib/data";
import { HttpError } from "@/lib/route-handlers";

/** `.catch()` handler for writes sent with `expectedRevision`. */
export function staleRevision(error: unknown): never {
  if (error instanceof DataError && error.code === "VERSION_CONFLICT") {
    throw new HttpError(409, "记录已被他人更新，请刷新后重试");
  }
  throw error;
}
