// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../core/resource';
import * as ContentAPI from './content';
import { Content } from './content';
import * as VersionsAPI from './versions/versions';
import { Versions, } from './versions/versions';
import { CursorPage } from '../../core/pagination';
import { maybeMultipartFormRequestOptions } from '../../internal/uploads';
import { path } from '../../internal/utils/path';
export class Skills extends APIResource {
    content = new ContentAPI.Content(this._client);
    versions = new VersionsAPI.Versions(this._client);
    /**
     * Create a new skill.
     */
    create(body = {}, options) {
        return this._client.post('/skills', maybeMultipartFormRequestOptions({ body, ...options }, this._client));
    }
    /**
     * Get a skill by its ID.
     */
    retrieve(skillID, options) {
        return this._client.get(path `/skills/${skillID}`, options);
    }
    /**
     * Update the default version pointer for a skill.
     */
    update(skillID, body, options) {
        return this._client.post(path `/skills/${skillID}`, { body, ...options });
    }
    /**
     * List all skills for the current project.
     */
    list(query = {}, options) {
        return this._client.getAPIList('/skills', (CursorPage), { query, ...options });
    }
    /**
     * Delete a skill by its ID.
     */
    delete(skillID, options) {
        return this._client.delete(path `/skills/${skillID}`, options);
    }
}
Skills.Content = Content;
Skills.Versions = Versions;
//# sourceMappingURL=skills.js.map