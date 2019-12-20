"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ono_1 = require("ono");
const modded_express_mung_1 = require("./modded.express.mung");
const ajv_1 = require("../framework/ajv");
const util_1 = require("./util");
const mediaTypeParser = require("media-typer");
const contentTypeParser = require("content-type");
class ResponseValidator {
    constructor(openApiSpec, options = {}) {
        this.validatorsCache = {};
        this.spec = openApiSpec;
        this.ajv = ajv_1.createResponseAjv(openApiSpec, options);
        modded_express_mung_1.default.onError = (err, req, res, next) => {
            return next(err);
        };
    }
    validate() {
        return modded_express_mung_1.default.json((body, req, res) => {
            var _a;
            if (req.openapi) {
                const responses = (_a = req.openapi.schema) === null || _a === void 0 ? void 0 : _a.responses;
                const validators = this._getOrBuildValidator(req, responses);
                const statusCode = res.statusCode;
                const path = req.originalUrl;
                return this._validate({ validators, body, statusCode, path });
            }
            return body;
        });
    }
    // TODO public for test only - fix me
    _getOrBuildValidator(req, responses) {
        if (!req) {
            // use !req is only possible in unit tests
            return this.buildValidators(responses);
        }
        const contentTypeKey = util_1.ContentType.from(req).equivalents()[0] || 'not_provided';
        const key = `${req.method}-${req.originalUrl}-${contentTypeKey}`;
        let validators = this.validatorsCache[key];
        if (!validators) {
            validators = this.buildValidators(responses);
            this.validatorsCache[key] = validators;
        }
        return validators;
    }
    // TODO public for test only - fix me
    _validate({ validators, body, statusCode, path }) {
        // find the validator for the 'status code' e.g 200, 2XX or 'default'
        let validator;
        const status = statusCode;
        if (status) {
            const statusXX = status.toString()[0] + 'XX';
            if (status in validators)
                validator = validators[status];
            else if (statusXX in validators)
                validator = validators[statusXX];
            else if (validators.default)
                validator = validator.default;
            else {
                throw util_1.validationError(500, path, `no schema defined for status code '${status}' in the openapi spec`);
            }
        }
        if (!validator) {
            console.warn('no validator found');
            // assume valid
            return;
        }
        const valid = validator({
            response: body,
        });
        if (!valid) {
            const errors = util_1.augmentAjvErrors(validator.errors);
            const message = this.ajv.errorsText(errors, {
                dataVar: '',
            });
            throw ono_1.default(util_1.ajvErrorsToValidatorError(500, errors), message);
        }
    }
    /**
     * Build a map of response name to response validator, for the set of responses
     * defined on the current endpoint endpoint
     * @param responses
     * @returns a map of validators
     */
    buildValidators(responses) {
        var _a;
        const canValidate = response => {
            if (typeof response.content !== 'object') {
                return false;
            }
            for (let contentType of Object.keys(response.content)) {
                const contentTypeParsed = contentTypeParser.parse(contentType);
                const mediaTypeParsed = mediaTypeParser.parse(contentTypeParsed.type);
                if (mediaTypeParsed.subtype === 'json' ||
                    mediaTypeParsed.suffix === 'json') {
                    return response.content[contentType] &&
                        response.content[contentType].schema
                        ? contentType
                        : false;
                }
            }
            return false;
        };
        const schemas = {};
        for (const [name, response] of Object.entries(responses)) {
            const mediaTypeToValidate = canValidate(response);
            if (!mediaTypeToValidate) {
                // TODO support content other than JSON
                // don't validate
                // assume is valid
                continue;
            }
            const schema = response.content[mediaTypeToValidate].schema;
            schemas[name] = {
                // $schema: 'http://json-schema.org/schema#',
                // $schema: "http://json-schema.org/draft-04/schema#",
                type: 'object',
                properties: {
                    response: schema,
                },
                components: (_a = this.spec.components, (_a !== null && _a !== void 0 ? _a : {})),
            };
        }
        const validators = {};
        for (const [name, schema] of Object.entries(schemas)) {
            validators[name] = this.ajv.compile(schema);
        }
        return validators;
    }
}
exports.ResponseValidator = ResponseValidator;
//# sourceMappingURL=openapi.response.validator.js.map