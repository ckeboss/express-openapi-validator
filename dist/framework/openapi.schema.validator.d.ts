import * as Ajv from 'ajv';
export declare class OpenAPISchemaValidator {
    private validator;
    constructor({ version, extensions }: {
        version: string;
        extensions?: object;
    });
    validate(openapiDoc: any): {
        errors: Ajv.ErrorObject[];
    };
}
