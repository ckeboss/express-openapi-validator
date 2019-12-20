"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ono_1 = require("ono");
const _ = require("lodash");
const middlewares = require("./middlewares");
const openapi_context_1 = require("./framework/openapi.context");
const openapi_spec_loader_1 = require("./framework/openapi.spec.loader");
const util_1 = require("./middlewares/util");
class OpenApiValidator {
    constructor(options) {
        this.validateOptions(options);
        this.normalizeOptions(options);
        if (options.unknownFormats == null)
            options.unknownFormats === true;
        if (options.coerceTypes == null)
            options.coerceTypes = true;
        if (options.validateRequests == null)
            options.validateRequests = true;
        if (options.validateResponses == null)
            options.validateResponses = false;
        if (options.validateSecurity == null)
            options.validateSecurity = true;
        if (options.validateResponses === true) {
            options.validateResponses = {
                removeAdditional: false,
            };
        }
        if (options.validateRequests === true) {
            options.validateRequests = {
                allowUnknownQueryParameters: false,
            };
        }
        if (options.validateSecurity === true) {
            options.validateSecurity = {};
        }
        this.options = options;
    }
    installSync(app) {
        const spec = new openapi_spec_loader_1.OpenApiSpecLoader({
            apiDoc: this.options.apiSpec,
        }).loadSync();
        this.installMiddleware(app, spec);
    }
    install(app, callback) {
        const p = new openapi_spec_loader_1.OpenApiSpecLoader({
            apiDoc: this.options.apiSpec,
        })
            .load()
            .then(spec => this.installMiddleware(app, spec));
        const useCallback = callback && typeof callback === 'function';
        if (useCallback) {
            p.catch(e => {
                callback(e);
            });
        }
        else {
            return p;
        }
    }
    installMiddleware(app, spec) {
        var _a;
        const context = new openapi_context_1.OpenApiContext(spec, this.options.ignorePaths);
        this.installPathParams(app, context);
        this.installMetadataMiddleware(app, context);
        this.installMultipartMiddleware(app, context);
        const components = context.apiDoc.components;
        if (this.options.validateSecurity && ((_a = components) === null || _a === void 0 ? void 0 : _a.securitySchemes)) {
            this.installSecurityMiddleware(app, context);
        }
        if (this.options.validateRequests) {
            this.installRequestValidationMiddleware(app, context);
        }
        if (this.options.validateResponses) {
            this.installResponseValidationMiddleware(app, context);
        }
    }
    installPathParams(app, context) {
        const pathParams = [];
        for (const route of context.routes) {
            if (route.pathParams.length > 0) {
                pathParams.push(...route.pathParams);
            }
        }
        // install param on routes with paths
        for (const p of _.uniq(pathParams)) {
            app.param(p, (req, res, next, value, name) => {
                const { pathParams } = req.openapi;
                if (pathParams) {
                    // override path params
                    req.params[name] = pathParams[name] || req.params[name];
                }
                next();
            });
        }
    }
    installMetadataMiddleware(app, context) {
        app.use(middlewares.applyOpenApiMetadata(context));
    }
    installMultipartMiddleware(app, context) {
        app.use(middlewares.multipart(context, this.options.multerOpts));
    }
    installSecurityMiddleware(app, context) {
        var _a;
        const securityHandlers = (_a = (this.options.validateSecurity)) === null || _a === void 0 ? void 0 : _a.handlers;
        const securityMiddleware = middlewares.security(context, securityHandlers);
        app.use(securityMiddleware);
    }
    installRequestValidationMiddleware(app, context) {
        const { coerceTypes, unknownFormats, validateRequests } = this.options;
        const { allowUnknownQueryParameters } = (validateRequests);
        const requestValidator = new middlewares.RequestValidator(context.apiDoc, {
            nullable: true,
            coerceTypes,
            removeAdditional: false,
            useDefaults: true,
            unknownFormats,
            allowUnknownQueryParameters,
        });
        const requestValidationHandler = (req, res, next) => requestValidator.validate(req, res, next);
        app.use(requestValidationHandler);
    }
    installResponseValidationMiddleware(app, context) {
        const { coerceTypes, unknownFormats, validateResponses } = this.options;
        const { removeAdditional } = validateResponses;
        const responseValidator = new middlewares.ResponseValidator(context.apiDoc, {
            nullable: true,
            coerceTypes,
            removeAdditional,
            unknownFormats,
        });
        app.use(responseValidator.validate());
    }
    validateOptions(options) {
        if (!options.apiSpec)
            throw ono_1.default('apiSpec required');
        const securityHandlers = options.securityHandlers;
        if (securityHandlers != null) {
            if (typeof securityHandlers !== 'object' ||
                Array.isArray(securityHandlers)) {
                throw ono_1.default('securityHandlers must be an object or undefined');
            }
            util_1.deprecationWarning('securityHandlers is deprecated. Use validateSecurities.handlers instead.');
        }
        if (options.securityHandlers && options.validateSecurity) {
            throw ono_1.default('securityHandlers and validateSecurity may not be used together. Use validateSecurities.handlers to specify handlers.');
        }
        const unknownFormats = options.unknownFormats;
        if (typeof unknownFormats === 'boolean') {
            if (!unknownFormats) {
                throw ono_1.default("unknownFormats must contain an array of unknownFormats, 'ignore' or true");
            }
        }
        else if (typeof unknownFormats === 'string' &&
            unknownFormats !== 'ignore' &&
            !Array.isArray(unknownFormats))
            throw ono_1.default("unknownFormats must contain an array of unknownFormats, 'ignore' or true");
    }
    normalizeOptions(options) {
        // Modify the recquest
        if (options.securityHandlers) {
            options.validateSecurity = {
                handlers: options.securityHandlers,
            };
            delete options.securityHandlers;
        }
    }
}
exports.OpenApiValidator = OpenApiValidator;
//# sourceMappingURL=index.js.map