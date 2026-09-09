/**
 * dsh-steer host half: intentionally inert.
 * All capability lives in the browser half (`./client`). This module only
 * gives the Cordis loader a valid plugin row to mount so the client module
 * system serves the browser bundle.
 */
export const name = "dsh-steer";
export function apply() {}
