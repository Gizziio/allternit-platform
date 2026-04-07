// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../../core/resource';
import * as SessionsAPI from './sessions';
import { Sessions } from './sessions';
import * as ThreadsAPI from './threads';
import { Threads, } from './threads';
export class ChatKit extends APIResource {
    sessions = new SessionsAPI.Sessions(this._client);
    threads = new ThreadsAPI.Threads(this._client);
}
ChatKit.Sessions = Sessions;
ChatKit.Threads = Threads;
//# sourceMappingURL=chatkit.js.map