import { afterAll, beforeAll, describe, it } from 'vitest';
import { call, FuzzServer, login, startServer } from './harness';
import { assertJsonErrors, assertRobust } from './oracles';
import { REGRESSIONS } from './regressions';

let server: FuzzServer;
let token: string;
beforeAll(async () => {
  server = await startServer();
  token = await login(server);
});
afterAll(async () => {
  await server.stop();
});

describe('regression corpus: every request that ever broke the app', () => {
  it.each(REGRESSIONS)('$id', async (c) => {
    const res = await call(server, c.method, c.path, { body: c.body, token: c.auth ? token : undefined });
    assertRobust(server, `${c.method} ${c.path}`, res);
    assertJsonErrors(`${c.method} ${c.path}`, res);
  });
});
