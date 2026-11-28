import { Exception } from '@adonisjs/core/exceptions'
import type StaffUser from '#models/staff_user'

/**
 * The hook R2-07 fills (D-477): support turns a Minta Bantuan request
 * into a Bank Masalah problem with one action. Until then the console
 * hides the button (`PROBLEM_HOOK_READY`) and a call fails loudly.
 *
 * Contract for R2-07:
 * - checks `problems.record` and the request's scope (staffReaches in
 *   help_requests.ts) before anything else;
 * - creates the problem (source `help_request`) and its reporter row
 *   from the request, or links an existing problem;
 * - sets the request to Diproses through `changeHelpStatus`, so the
 *   sender is told, and logs `help_request.to_problem`;
 * - returns the problem's id; the console then shows it on the request.
 */
export class ProblemHookNotReadyException extends Exception {
  static status = 501
  static code = 'E_PROBLEM_HOOK_NOT_READY'
  static message = 'Bank Masalah is not built yet (R2-07).'
}

/** True once R2-07 implements `helpRequestToProblem`. */
export const PROBLEM_HOOK_READY = false

export async function helpRequestToProblem(
  _staff: StaffUser,
  _helpRequestId: number
): Promise<{ problemId: number }> {
  throw new ProblemHookNotReadyException()
}
