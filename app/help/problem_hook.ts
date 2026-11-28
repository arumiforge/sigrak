/**
 * The hook R2-07 fills (D-477): support turns a Minta Bantuan request
 * into a Bank Masalah problem with one action ("Jadikan masalah").
 *
 * `helpRequestToProblem` (app/problems/problems.ts):
 * - checks `problems.record` and the request's scope (staffReaches in
 *   help_requests.ts) before anything else;
 * - creates the problem (source `help_request`, region and level from
 *   the sender's school) and its reporter row from the request, or
 *   links the request to an open problem;
 * - sets the request to Diproses and tells the sender it was recorded,
 *   logged as `help_request.to_problem`;
 * - returns the problem's id; the console then shows it on the request.
 */
export { helpRequestToProblem } from '#problems/problems'

/** True since R2-07 implemented `helpRequestToProblem`. */
export const PROBLEM_HOOK_READY = true
