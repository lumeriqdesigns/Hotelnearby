import { ZodError } from "zod";

import {
  type ActionResult,
  fail,
  fieldErrorsFromZod,
  isExpectedError,
  toSafeError,
} from "./errors";
import { logger } from "./logger";

/**
 * Wrap a server action body so that:
 *  - expected failures become typed `{ ok: false }` results,
 *  - unexpected failures are logged in full and returned as a generic message.
 *
 * Authorisation and validation still belong inside `run`. This only shapes
 * the outcome.
 */
export async function runAction<T>(
  name: string,
  run: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ZodError) {
      return fail("VALIDATION_FAILED", "Some details need fixing.", fieldErrorsFromZod(error));
    }
    if (!isExpectedError(error)) logger.error(`Action failed: ${name}`, { error });
    const safe = toSafeError(error);
    return fail(safe.code, safe.message, safe.fieldErrors);
  }
}
