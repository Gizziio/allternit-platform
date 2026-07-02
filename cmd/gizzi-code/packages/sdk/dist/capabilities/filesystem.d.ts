import type { Tool } from '../harness/types.js';
import type { IEnvironment } from '../environment/types.js';
export declare const FILESYSTEM_TOOLS: Tool[];
export declare class FilesystemCapability {
    private environment;
    constructor(environment: IEnvironment);
    getTools(): Tool[];
    execute(name: string, args: any): Promise<string>;
}
//# sourceMappingURL=filesystem.d.ts.map