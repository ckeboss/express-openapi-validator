import { NextFunction, Response } from 'express';
import { OpenAPIV3, OpenApiRequest, RequestValidatorOptions } from '../framework/types';
export declare class RequestValidator {
    private _middlewareCache;
    private _apiDocs;
    private ajv;
    private _requestOpts;
    constructor(apiDocs: OpenAPIV3.Document, options?: RequestValidatorOptions);
    validate(req: OpenApiRequest, res: Response, next: NextFunction): void;
    private buildMiddleware;
    private rejectUnknownQueryParams;
    private requestBodyToSchema;
    private cleanseContentSchema;
    private getSecurityQueryParams;
    private parametersToSchema;
    private parseQueryParamsFromURL;
}
