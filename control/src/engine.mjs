/** Retired prototype. GitHub and the existing runtime own execution and approval. */
export const RETIRED = 'ENCH CONTROL prototype retired: use the existing runtime and GitHub review; local state cannot authorize execution, merge or deployment.';
function retired() { throw new Error(RETIRED); }
export const validateIntent = retired;
export const createTask = retired;
export const transition = retired;
export const saveTask = retired;
export const loadTask = retired;
export const updateTask = retired;
