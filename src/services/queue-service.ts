import { z } from "zod";
import type { User } from "../domain/models.js";
import { AppError } from "../lib/errors.js";
import type { SharePointRepository } from "../repositories/repository.js";
const joinInput = z.object({ reservationId: z.string().optional(), queueType: z.enum(["Express", "Regular"]).default("Regular") });
export class QueueService {
  constructor(private repo: SharePointRepository) {}
  mine(user: User) { return this.repo.queues.filter((q) => q.customerEmail === user.email && ["Waiting", "Serving"].includes(q.status)); }
  status() { return { waiting: this.repo.queues.filter((q) => q.status === "Waiting").length, serving: this.repo.queues.filter((q) => q.status === "Serving").map((q) => q.queueNumber) }; }
  join(input: unknown, user: User) { const parsed = joinInput.safeParse(input); if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid queue request."); if (this.mine(user).length) throw new AppError("QUEUE_ALREADY_JOINED", "Already in the pickup queue."); const queue = { id: `queue-${this.repo.queues.length + 1}`, queueNumber: `${parsed.data.queueType === "Express" ? "E" : "R"}-${String(this.repo.queues.length + 1).padStart(3, "0")}`, customerEmail: user.email, reservationId: parsed.data.reservationId, queueType: parsed.data.queueType, status: "Waiting" as const, queueDate: new Date().toISOString() }; this.repo.queues.push(queue); return queue; }
  leave(user: User) { const queue = this.mine(user)[0]; if (!queue) throw new AppError("QUEUE_NOT_FOUND", "Active queue entry not found."); queue.status = "Completed"; return queue; }
}

