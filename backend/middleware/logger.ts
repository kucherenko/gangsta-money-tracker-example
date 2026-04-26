export const loggerMiddleware = async (c: any, next: any) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${c.req.method} ${c.req.url} - ${c.res.status} (${ms}ms)`);
};
