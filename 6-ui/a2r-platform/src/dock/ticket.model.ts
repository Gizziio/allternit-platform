export type TicketStatus = "idle" | "queued" | "running" | "blocked" | "done";
export interface Ticket { id: string; title: string; status: TicketStatus; createdAt: number; }
