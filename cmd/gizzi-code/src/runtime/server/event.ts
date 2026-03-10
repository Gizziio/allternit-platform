import { BusEvent } from "@/shared/bus/bus-event"
import z from "zod/v4"

export const Event = {
  Connected: BusEvent.define("server.connected", z.object({})),
  Disposed: BusEvent.define("global.disposed", z.object({})),
}
