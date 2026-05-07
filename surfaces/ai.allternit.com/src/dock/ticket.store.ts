import { create } from "zustand";
import type { Ticket } from "./ticket.model";

export const useTicketStore = create<{
  tickets: Ticket[];
  addTicket: (t: Pick<Ticket, "title">) => void;
}>(() => ({
  tickets: [],
  addTicket: ({ title }) => useTicketStore.setState((s) => ({
    tickets: [{ id: crypto.randomUUID(), title, status: "queued", createdAt: Date.now() }, ...s.tickets],
  })),
}));
