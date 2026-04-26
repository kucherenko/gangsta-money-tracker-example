export const errorHandler = (err: any, c: any) => {
  console.error(err);

  if (err.status && err.status < 500) {
    return c.json({ error: err.message || "Request error" }, err.status);
  }

  return c.json({ error: "Internal server error" }, 500);
};
