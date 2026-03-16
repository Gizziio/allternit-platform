/**
 * @a2r/util/slug — unique slug generator
 */
import { randomBytes } from "crypto"

export const Slug = {
  create() {
    return randomBytes(8).toString("base64url")
  }
}
