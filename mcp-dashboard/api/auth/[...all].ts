import { toNodeHandler } from "better-auth/node";
import { auth } from "../lib/auth.js";

export default toNodeHandler(auth);
