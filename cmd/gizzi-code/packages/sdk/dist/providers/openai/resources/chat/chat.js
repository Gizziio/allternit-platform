// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../core/resource';
import * as CompletionsAPI from './completions/completions';
import { Completions, } from './completions/completions';
export class Chat extends APIResource {
    completions = new CompletionsAPI.Completions(this._client);
}
Chat.Completions = Completions;
//# sourceMappingURL=chat.js.map