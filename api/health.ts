import { ok, secure, type RequestLike, type ResponseLike } from "../src/lib/http.js";
export default function health(_req: RequestLike, res: ResponseLike) { secure(res); res.status(200).json(ok({ status: "healthy", service: "bulldogs-xchange" })); }

