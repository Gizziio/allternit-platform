// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../../core/resource';
import * as ContentAPI from './content';
import { Content } from './content';
import { CursorPage } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { maybeMultipartFormRequestOptions } from '../../../internal/uploads';
import { path } from '../../../internal/utils/path';
export class Files extends APIResource {
    content = new ContentAPI.Content(this._client);
    /**
     * Create a Container File
     *
     * You can send either a multipart/form-data request with the raw file content, or
     * a JSON request with a file ID.
     */
    create(containerID, body, options) {
        return this._client.post(path `/containers/${containerID}/files`, maybeMultipartFormRequestOptions({ body, ...options }, this._client));
    }
    /**
     * Retrieve Container File
     */
    retrieve(fileID, params, options) {
        const { container_id } = params;
        return this._client.get(path `/containers/${container_id}/files/${fileID}`, options);
    }
    /**
     * List Container files
     */
    list(containerID, query = {}, options) {
        return this._client.getAPIList(path `/containers/${containerID}/files`, (CursorPage), {
            query,
            ...options,
        });
    }
    /**
     * Delete Container File
     */
    delete(fileID, params, options) {
        const { container_id } = params;
        return this._client.delete(path `/containers/${container_id}/files/${fileID}`, {
            ...options,
            headers: buildHeaders([{ Accept: '*/*' }, options?.headers]),
        });
    }
}
Files.Content = Content;
//# sourceMappingURL=files.js.map