
/**
 * Returns the current date in YYYY-MM-DD format using local time.
 * This avoids the common UTC shift issue with toISOString().
 */
export const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns the current timestamp in ISO format but using local time components?
 * No, createdAt should probably stay UTC for consistency, but if the user
 * expects local time for display, we should handle it.
 * However, the user's specific complaint is about the "date" field (YYYY-MM-DD).
 */
