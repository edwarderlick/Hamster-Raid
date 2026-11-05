export const SKIP_TRAIN_KEY = "wb-skip-train";

export function hasSkippedTrain(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(SKIP_TRAIN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSkippedTrain(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(SKIP_TRAIN_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSkippedTrain(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(SKIP_TRAIN_KEY);
  } catch {
    /* ignore */
  }
}
