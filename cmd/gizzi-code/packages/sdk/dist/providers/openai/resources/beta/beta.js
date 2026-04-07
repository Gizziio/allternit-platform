// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../core/resource';
import * as AssistantsAPI from './assistants';
import { Assistants, } from './assistants';
import * as RealtimeAPI from './realtime/realtime';
import { Realtime, } from './realtime/realtime';
import * as ChatKitAPI from './chatkit/chatkit';
import { ChatKit } from './chatkit/chatkit';
import * as ThreadsAPI from './threads/threads';
import { Threads, } from './threads/threads';
export class Beta extends APIResource {
    realtime = new RealtimeAPI.Realtime(this._client);
    chatkit = new ChatKitAPI.ChatKit(this._client);
    assistants = new AssistantsAPI.Assistants(this._client);
    threads = new ThreadsAPI.Threads(this._client);
}
Beta.Realtime = Realtime;
Beta.ChatKit = ChatKit;
Beta.Assistants = Assistants;
Beta.Threads = Threads;
//# sourceMappingURL=beta.js.map