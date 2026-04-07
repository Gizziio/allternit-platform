// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../../core/resource';
import * as PermissionsAPI from './permissions';
import { Permissions, } from './permissions';
export class Checkpoints extends APIResource {
    permissions = new PermissionsAPI.Permissions(this._client);
}
Checkpoints.Permissions = Permissions;
//# sourceMappingURL=checkpoints.js.map