// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../../core/resource';
import * as SessionsAPI from './sessions';
import { Sessions, } from './sessions';
import * as TranscriptionSessionsAPI from './transcription-sessions';
import { TranscriptionSessions, } from './transcription-sessions';
/**
 * @deprecated Realtime has now launched and is generally available. The old beta API is now deprecated.
 */
export class Realtime extends APIResource {
    sessions = new SessionsAPI.Sessions(this._client);
    transcriptionSessions = new TranscriptionSessionsAPI.TranscriptionSessions(this._client);
}
Realtime.Sessions = Sessions;
Realtime.TranscriptionSessions = TranscriptionSessions;
//# sourceMappingURL=realtime.js.map