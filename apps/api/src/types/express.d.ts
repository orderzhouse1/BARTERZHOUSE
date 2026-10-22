import type { Request } from 'express';

import type { AuthContext } from '../modules/auth/auth.types.js';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    user?: AuthContext;
    csrfValidated?: boolean;
  }
}

export type RequestWithId = Request & { requestId: string };
