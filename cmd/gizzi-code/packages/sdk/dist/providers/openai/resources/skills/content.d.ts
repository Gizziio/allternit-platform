import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
export declare class Content extends APIResource {
    /**
     * Download a skill zip bundle by its ID.
     */
    retrieve(skillID: string, options?: RequestOptions): APIPromise<Response>;
}
//# sourceMappingURL=content.d.ts.map