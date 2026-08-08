import type { Request } from "express";
import type { AuthenticatedUser } from "./jwt.strategy.js";

/**
 * An authenticated Express request.
 *
 * Previously redeclared in seven controllers, each extending the DOM's `Request` rather
 * than Express's — harmless only because nothing but `.user` was ever read off it.
 */
export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
