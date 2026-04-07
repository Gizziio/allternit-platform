import { APIResource } from '../../../core/resource';
import { APIPromise } from '../../../core/api-promise';
import { RequestOptions } from '../../../internal/request-options';
export declare class Content extends APIResource {
    /**
     * Download a skill version zip bundle.
     */
    retrieve(version: string, params: ContentRetrieveParams, options?: RequestOptions): APIPromise<Response>;
}
export interface ContentRetrieveParams {
    /**
     * The identifier of the skill.
     */
    skill_id: string;
}
export declare namespace Content {
    export { type ContentRetrieveParams as ContentRetrieveParams };
}
//# sourceMappingURL=content.d.ts.map