/** MSW node server shared by all tests. Override per test with `server.use(...)`. */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
