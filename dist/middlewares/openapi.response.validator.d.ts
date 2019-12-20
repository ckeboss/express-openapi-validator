import * as ajv from 'ajv';
import { OpenAPIV3 } from '../framework/types';
export declare class ResponseValidator {
    private ajv;
    private spec;
    private validatorsCache;
    constructor(openApiSpec: OpenAPIV3.Document, options?: ajv.Options);
    validate(): any;
    _getOrBuildValidator(req: any, responses: any): any;
    _validate({ validators, body, statusCode, path }: {
        validators: any;
        body: any;
        statusCode: any;
        path: any;
    }): void;
    /**
     * Build a map of response name to response validator, for the set of responses
     * defined on the current endpoint endpoint
     * @param responses
     * @returns a map of validators
     */
    private buildValidators;
}
