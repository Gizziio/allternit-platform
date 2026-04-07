// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../core/resource';
import * as FilesAPI from './files/files';
import { Files, } from './files/files';
import { CursorPage } from '../../core/pagination';
import { buildHeaders } from '../../internal/headers';
import { path } from '../../internal/utils/path';
export class Containers extends APIResource {
    files = new FilesAPI.Files(this._client);
    /**
     * Create Container
     */
    create(body, options) {
        return this._client.post('/containers', { body, ...options });
    }
    /**
     * Retrieve Container
     */
    retrieve(containerID, options) {
        return this._client.get(path `/containers/${containerID}`, options);
    }
    /**
     * List Containers
     */
    list(query = {}, options) {
        return this._client.getAPIList('/containers', (CursorPage), { query, ...options });
    }
    /**
     * Delete Container
     */
    delete(containerID, options) {
        return this._client.delete(path `/containers/${containerID}`, {
            ...options,
            headers: buildHeaders([{ Accept: '*/*' }, options?.headers]),
        });
    }
}
Containers.Files = Files;
//# sourceMappingURL=containers.js.map