import { OpenAPIV3 } from './types';
interface ServerUrlVariables {
    [key: string]: ServerUrlValues;
}
interface ServerUrlValues {
    enum: string[];
    default?: string;
}
export declare class BasePath {
    readonly variables: ServerUrlVariables;
    readonly path: string;
    private allPaths;
    constructor(server: OpenAPIV3.ServerObject);
    hasVariables(): boolean;
    all(): string[];
    static fromServers(servers: OpenAPIV3.ServerObject[]): BasePath[];
    private findUrlPath;
}
export {};
