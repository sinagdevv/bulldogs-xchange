import { z } from "zod";
import type { User } from "../domain/models.js";
import { AppError } from "../lib/errors.js";
import type { SharePointRepository } from "../repositories/repository.js";
import { isMockRepository } from "../repositories/provider.js";
const joinInput = z.object({ reservationId: z.string().optional(), queueType: z.enum(["Express", "Regular"]).default("Regular") });
export class QueueService {
  constructor(private repo: SharePointRepository) {}
  async mine(user: User) { return (await this.repo.getQueuesByCustomerEmail(user.email)).filter((q) => ["Waiting", "Serving"].includes(q.status)); }
  async status() { const queues = await this.repo.getQueues(); return { waiting: queues.filter((q) => q.status === "Waiting").length, serving: queues.filter((q) => q.status === "Serving").map((q) => q.queueNumber) }; }
  async join(input: unknown, user: User) { if (!isMockRepository(this.repo)) throw new AppError("CONFIGURATION_ERROR", "Queue writes are not implemented for the selected data provider."); const parsed = joinInput.safeParse(input); if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid queue request."); if ((await this.mine(user)).length) throw new AppError("QUEUE_ALREADY_JOINED", "Already in the pickup queue."); const queue = { id: `queue-${this.repo.queues.length + 1}`, queueNumber: `${parsed.data.queueType === "Express" ? "E" : "R"}-${String(this.repo.queues.length + 1).padStart(3, "0")}`, customerEmail: user.email, reservationId: parsed.data.reservationId, queueType: parsed.data.queueType, status: "Waiting" as const, queueDate: new Date().toISOString() }; this.repo.queues.push(queue); return queue; }
  async leave(user: User) { if (!isMockRepository(this.repo)) throw new AppError("CONFIGURATION_ERROR", "Queue writes are not implemented for the selected data provider."); const queue = (await this.mine(user)).find((item) => item.status === "Waiting"); if (!queue) throw new AppError("QUEUE_NOT_FOUND", "Waiting queue entry not found."); queue.status = "Left"; return queue; }
}
