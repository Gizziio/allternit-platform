// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../core/resource';
import * as CallsAPI from './calls';
import { Calls } from './calls';
import * as ClientSecretsAPI from './client-secrets';
import { ClientSecrets, } from './client-secrets';
export class Realtime extends APIResource {
    clientSecrets = new ClientSecretsAPI.ClientSecrets(this._client);
    calls = new CallsAPI.Calls(this._client);
}
Realtime.ClientSecrets = ClientSecrets;
Realtime.Calls = Calls;
//# sourceMappingURL=realtime.js.map