"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ajv_1 = require("../framework/ajv");
const util_1 = require("./util");
const ono_1 = require("ono");
const mediaTypeParser = require("media-typer");
const contentTypeParser = require("content-type");
class RequestValidator {
    constructor(apiDocs, options = {}) {
        this._middlewareCache = {};
        this._requestOpts = {};
        this._middlewareCache = {};
        this._apiDocs = apiDocs;
        this._requestOpts.allowUnknownQueryParameters =
            options.allowUnknownQueryParameters;
        this.ajv = ajv_1.createRequestAjv(apiDocs, options);
    }
    validate(req, res, next) {
        var _a;
        if (!req.openapi) {
            // this path was not found in open api and
            // this path is not defined under an openapi base path
            // skip it
            return next();
        }
        const openapi = req.openapi;
        const path = openapi.expressRoute;
        if (!path) {
            throw util_1.validationError(404, req.path, 'not found');
        }
        const pathSchema = openapi.schema;
        if (!pathSchema) {
            // add openapi metadata to make this case more clear
            // its not obvious that missig schema means methodNotAllowed
            throw util_1.validationError(405, req.path, `${req.method} method not allowed`);
        }
        // cache middleware by combining method, path, and contentType
        // TODO contentType could have value not_provided
        const contentType = util_1.ContentType.from(req);
        const contentTypeKey = (_a = contentType.equivalents()[0], (_a !== null && _a !== void 0 ? _a : 'not_provided'));
        const key = `${req.method}-${req.originalUrl}-${contentTypeKey}`;
        if (!this._middlewareCache[key]) {
            this._middlewareCache[key] = this.buildMiddleware(path, pathSchema, contentType);
        }
        return this._middlewareCache[key](req, res, next);
    }
    buildMiddleware(path, pathSchema, contentType) {
        var _a, _b, _c;
        const parameters = this.parametersToSchema(path, pathSchema.parameters);
        let usedSecuritySchema = [];
        if (pathSchema.hasOwnProperty('security') &&
            pathSchema.security.length > 0) {
            usedSecuritySchema = pathSchema.security;
        }
        else if (this._apiDocs.hasOwnProperty('security') &&
            this._apiDocs.security.length > 0) {
            // if no security schema for the path, use top-level security schema
            usedSecuritySchema = this._apiDocs.security;
        }
        const securityQueryParameter = this.getSecurityQueryParams(usedSecuritySchema, (_a = this._apiDocs.components) === null || _a === void 0 ? void 0 : _a.securitySchemes);
        let requestBody = pathSchema.requestBody;
        if ((_b = requestBody) === null || _b === void 0 ? void 0 : _b.hasOwnProperty('$ref')) {
            const ref = requestBody.$ref;
            const id = ref.replace(/^.+\//i, '');
            requestBody = this._apiDocs.components.requestBodies[id];
        }
        let body = {};
        const requiredAdds = [];
        if ((_c = requestBody) === null || _c === void 0 ? void 0 : _c.hasOwnProperty('content')) {
            const reqBodyObject = requestBody;
            body = this.requestBodyToSchema(path, contentType, reqBodyObject);
            if (reqBodyObject.required)
                requiredAdds.push('body');
        }
        const schema = {
            // $schema: "http://json-schema.org/draft-04/schema#",
            required: ['query', 'headers', 'params'].concat(requiredAdds),
            properties: Object.assign({ body }, parameters.schema),
        };
        const validator = this.ajv.compile(schema);
        return (req, res, next) => {
            var _a, _b;
            const queryParamsToValidate = this.parseQueryParamsFromURL(req.originalUrl);
            if (!this._requestOpts.allowUnknownQueryParameters) {
                this.rejectUnknownQueryParams(queryParamsToValidate, schema.properties.query, securityQueryParameter);
            }
            const openapi = req.openapi;
            const shouldUpdatePathParams = Object.keys(openapi.pathParams).length > 0;
            if (shouldUpdatePathParams) {
                req.params = (_a = openapi.pathParams, (_a !== null && _a !== void 0 ? _a : req.params));
            }
            // (<any>req).schema = schema;
            /**
             * support json in request params, query, headers and cookies
             * like this filter={"type":"t-shirt","color":"blue"}
             *
             * https://swagger.io/docs/specification/describing-parameters/#schema-vs-content
             */
            parameters.parseJson.forEach(item => {
                var _a;
                if (item.reqField === 'query' && queryParamsToValidate[item.name]) {
                    if (queryParamsToValidate[item.name] === req[item.reqField][item.name]) {
                        try {
                            queryParamsToValidate[item.name] = req[item.reqField][item.name] = JSON.parse(queryParamsToValidate[item.name]);
                        }
                        catch (e) {
                        }
                        /**
                         * The query param we parse and the query param express
                         * parsed are the same value, so we assign them the same
                         * parsed value.
                         */
                        return;
                    }
                    /**
                     * They query params are not the same, so we parse the
                     * `queryParamsToValidate` and don't return.
                     */
                    try {
                        queryParamsToValidate[item.name] = JSON.parse(queryParamsToValidate[item.name]);
                    }
                    catch (e) {
                    }
                }
                if ((_a = req[item.reqField]) === null || _a === void 0 ? void 0 : _a[item.name]) {
                    try {
                        req[item.reqField][item.name] = JSON.parse(req[item.reqField][item.name]);
                    }
                    catch (e) {
                        // NOOP If parsing failed but _should_ contain JSON, validator will catch it.
                        // May contain falsely flagged parameter (e.g. input was object OR string)
                    }
                }
            });
            /**
             * array deserialization
             * filter=foo,bar,baz
             * filter=foo|bar|baz
             * filter=foo%20bar%20baz
             */
            parameters.parseArray.forEach(item => {
                var _a;
                if (item.reqField === 'query' && queryParamsToValidate[item.name]) {
                    if (queryParamsToValidate[item.name] === req[item.reqField][item.name]) {
                        queryParamsToValidate[item.name] = req[item.reqField][item.name] = queryParamsToValidate[item.name].split(item.delimiter);
                        return;
                    }
                    queryParamsToValidate[item.name] = queryParamsToValidate[item.name].split(item.delimiter);
                }
                if ((_a = req[item.reqField]) === null || _a === void 0 ? void 0 : _a[item.name]) {
                    req[item.reqField][item.name] = req[item.reqField][item.name].split(item.delimiter);
                }
            });
            /**
             * forcing convert to array if scheme describes param as array + explode
             */
            parameters.parseArrayExplode.forEach(item => {
                var _a;
                if (item.reqField === 'query' &&
                    queryParamsToValidate[item.name] &&
                    !(queryParamsToValidate[item.name] instanceof Array)) {
                    queryParamsToValidate[item.name] = [queryParamsToValidate[item.name]];
                }
                if (((_a = req[item.reqField]) === null || _a === void 0 ? void 0 : _a[item.name]) &&
                    !(req[item.reqField][item.name] instanceof Array)) {
                    req[item.reqField][item.name] = [req[item.reqField][item.name]];
                }
            });
            const reqToValidate = Object.assign(Object.assign({}, req), { query: queryParamsToValidate, cookies: req.cookies
                    ? Object.assign(Object.assign({}, req.cookies), req.signedCookies) : undefined });
            const valid = validator(reqToValidate);
            if (valid) {
                next();
            }
            else {
                // TODO look into Ajv async errors plugins
                const errors = util_1.augmentAjvErrors([...(_b = validator.errors, (_b !== null && _b !== void 0 ? _b : []))]);
                const err = util_1.ajvErrorsToValidatorError(400, errors);
                const message = this.ajv.errorsText(errors, { dataVar: 'request' });
                throw ono_1.default(err, message);
            }
        };
    }
    rejectUnknownQueryParams(query, schema, whiteList = []) {
        if (!schema.properties)
            return;
        const knownQueryParams = new Set(Object.keys(schema.properties));
        whiteList.forEach(item => knownQueryParams.add(item));
        const queryParams = Object.keys(query);
        for (const q of queryParams) {
            if (!knownQueryParams.has(q)) {
                throw util_1.validationError(400, `.query.${q}`, `Unknown query parameter ${q}`);
            }
        }
    }
    requestBodyToSchema(path, contentType, requestBody) {
        var _a;
        if (requestBody.content) {
            let content = null;
            for (const type of contentType.equivalents()) {
                content = requestBody.content[type];
                if (content)
                    break;
            }
            if (!content) {
                const msg = contentType.contentType === 'not_provided'
                    ? 'media type not specified'
                    : `unsupported media type ${contentType.contentType}`;
                throw util_1.validationError(415, path, msg);
            }
            const schema = this.cleanseContentSchema(contentType, requestBody);
            return _a = (schema !== null && schema !== void 0 ? schema : content.schema), (_a !== null && _a !== void 0 ? _a : {});
        }
        return {};
    }
    cleanseContentSchema(contentType, requestBody) {
        const bodyContentSchema = requestBody.content[contentType.contentType] &&
            requestBody.content[contentType.contentType].schema;
        let bodyContentRefSchema = null;
        if (bodyContentSchema && '$ref' in bodyContentSchema) {
            const objectSchema = this.ajv.getSchema(bodyContentSchema.$ref);
            bodyContentRefSchema =
                objectSchema &&
                    objectSchema.schema &&
                    objectSchema.schema.properties
                    ? Object.assign({}, objectSchema.schema) : null;
        }
        // handle readonly / required request body refs
        // don't need to copy schema if validator gets its own copy of the api spec
        // currently all middlware i.e. req and res validators share the spec
        const schema = bodyContentRefSchema || bodyContentSchema;
        if (schema && schema.properties) {
            Object.keys(schema.properties).forEach(prop => {
                const propertyValue = schema.properties[prop];
                const required = schema.required;
                if (propertyValue.readOnly && required) {
                    const index = required.indexOf(prop);
                    if (index > -1) {
                        schema.required = required
                            .slice(0, index)
                            .concat(required.slice(index + 1));
                    }
                }
            });
            return schema;
        }
    }
    getSecurityQueryParams(usedSecuritySchema, securitySchema) {
        return usedSecuritySchema && securitySchema
            ? usedSecuritySchema
                .filter(obj => Object.entries(obj).length !== 0)
                .map(sec => {
                const securityKey = Object.keys(sec)[0];
                return securitySchema[securityKey];
            })
                .filter(sec => { var _a; return ((_a = sec) === null || _a === void 0 ? void 0 : _a.in) === 'query'; })
                .map(sec => sec.name)
            : [];
    }
    parametersToSchema(path, parameters = []) {
        const schema = { query: {}, headers: {}, params: {}, cookies: {} };
        const reqFields = {
            query: 'query',
            header: 'headers',
            path: 'params',
            cookie: 'cookies',
        };
        const arrayDelimiter = {
            form: ',',
            spaceDelimited: ' ',
            pipeDelimited: '|',
        };
        const parseJson = [];
        const parseArray = [];
        const parseArrayExplode = [];
        parameters.forEach(parameter => {
            var _a, _b;
            if (parameter.hasOwnProperty('$ref')) {
                const id = parameter.$ref.replace(/^.+\//i, '');
                parameter = this._apiDocs.components.parameters[id];
            }
            const $in = parameter.in;
            const name = $in === 'header' ? parameter.name.toLowerCase() : parameter.name;
            const reqField = reqFields[$in];
            if (!reqField) {
                const message = `Parameter 'in' has incorrect value '${$in}' for [${parameter.name}]`;
                throw util_1.validationError(400, path, message);
            }
            let parameterSchema = parameter.schema;
            if (parameter.content) {
                /**
                 * Per the OpenAPI3 spec:
                 * A map containing the representations for the parameter. The key is the media type
                 * and the value describes it. The map MUST only contain one entry.
                 * https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#parameterContent
                 */
                const contentType = Object.keys(parameter.content)[0];
                const contentTypeParsed = contentTypeParser.parse(contentType);
                const mediaTypeParsed = mediaTypeParser.parse(contentTypeParsed.type);
                parameterSchema = parameter.content[contentType].schema;
                if (mediaTypeParsed.subtype === 'json' ||
                    mediaTypeParsed.suffix === 'json') {
                    parseJson.push({ name, reqField });
                }
            }
            else if ($in === 'query') {
                // handle complex json types in schema
                const schemaHasObject = schema => schema && (schema.type === 'object' ||
                    [].concat(schema.allOf, schema.oneOf, schema.anyOf).some(schemaHasObject));
                if (schemaHasObject(parameterSchema)) {
                    parseJson.push({ name, reqField });
                }
            }
            if (!parameterSchema) {
                const message = `No available parameter 'schema' or 'content' for [${parameter.name}]`;
                throw util_1.validationError(400, path, message);
            }
            if (((_a = parameter.schema) === null || _a === void 0 ? void 0 : _a.type) === 'array' && !parameter.explode) {
                const delimiter = arrayDelimiter[parameter.style];
                if (!delimiter) {
                    const message = `Parameter 'style' has incorrect value '${parameter.style}' for [${parameter.name}]`;
                    throw util_1.validationError(400, path, message);
                }
                parseArray.push({ name, reqField, delimiter });
            }
            if (((_b = parameter.schema) === null || _b === void 0 ? void 0 : _b.type) === 'array' && parameter.explode) {
                parseArrayExplode.push({ name, reqField });
            }
            if (!schema[reqField].properties) {
                schema[reqField] = {
                    type: 'object',
                    properties: {},
                };
            }
            schema[reqField].properties[name] = parameterSchema;
            if (parameter.required) {
                if (!schema[reqField].required) {
                    schema[reqField].required = [];
                }
                schema[reqField].required.push(name);
            }
        });
        return { schema, parseJson, parseArray, parseArrayExplode };
    }
    parseQueryParamsFromURL(url) {
        const queryIndex = url.indexOf('?');
        const queryString = (queryIndex >= 0) ? url.slice(queryIndex + 1) : '';
        const searchParams = new URLSearchParams(queryString);
        const queryParamsToValidate = {};
        searchParams.forEach((value, key) => {
            if (queryParamsToValidate[key]) {
                if (queryParamsToValidate[key] instanceof Array) {
                    queryParamsToValidate[key].push(value);
                }
                else {
                    queryParamsToValidate[key] = [queryParamsToValidate[key], value];
                }
            }
            else {
                queryParamsToValidate[key] = value;
            }
        });
        return queryParamsToValidate;
    }
}
exports.RequestValidator = RequestValidator;
//# sourceMappingURL=openapi.request.validator.js.map