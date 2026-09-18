/**
 * Transport Interface
 * TEMPORARY SHIM
 */

export interface Transport {
  send(data: unknown): void
  receive(): unknown
}

export class BaseTransport implements Transport {
  send(_data: unknown): void {
    // TODO: implement
  }
  
  receive(): unknown {
    // TODO: implement
    return null
  }
}

export default { BaseTransport }
