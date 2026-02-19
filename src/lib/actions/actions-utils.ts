/**
 * Discriminated union returned by server actions.
 *
 * @example
 * // Server action
 * export async function myAction(input: Input): Promise<ActionResult<OutputType>> {
 *   try {
 *     const data = await doSomething(input);
 *     return { data };
 *   } catch (err) {
 *     return { error: err instanceof Error ? err.message : "Unknown error" };
 *   }
 * }
 */
export type ActionSuccess<T> = { data: T; error?: never };
export type ActionFailure = { data?: never; error: string };
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

/**
 * Resolves a server action result, throwing on error.
 * Use in TanStack Form `onSubmit` to get typed data or surface errors as exceptions.
 *
 * @example
 * onSubmit: async (values) => {
 *   const result = await resolveActionResult(myServerAction(values));
 *   // result is typed as T — throws if action returned { error }
 * }
 */
export async function resolveActionResult<T>(
  promise: Promise<ActionResult<T>>,
): Promise<T> {
  const result = await promise;
  if (result.error !== undefined) {
    throw new Error(result.error);
  }
  return result.data;
}
