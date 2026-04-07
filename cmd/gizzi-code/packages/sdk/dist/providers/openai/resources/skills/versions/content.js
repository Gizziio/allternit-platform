// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../../core/resource';
import { buildHeaders } from '../../../internal/headers';
import { path } from '../../../internal/utils/path';
export class Content extends APIResource {
    /**
     * Download a skill version zip bundle.
     */
    retrieve(version, params, options) {
        const { skill_id } = params;
        return this._client.get(path `/skills/${skill_id}/versions/${version}/content`, {
            ...options,
            headers: buildHeaders([{ Accept: 'application/binary' }, options?.headers]),
            __binaryResponse: true,
        });
    }
}
//# sourceMappingURL=content.js.map