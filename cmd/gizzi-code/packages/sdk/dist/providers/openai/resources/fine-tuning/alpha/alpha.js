// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../../core/resource';
import * as GradersAPI from './graders';
import { Graders, } from './graders';
export class Alpha extends APIResource {
    graders = new GradersAPI.Graders(this._client);
}
Alpha.Graders = Graders;
//# sourceMappingURL=alpha.js.map