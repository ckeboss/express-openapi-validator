"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ono_1 = require("ono");
class ContentType {
    constructor(contentType) {
        this.withoutBoundary = null;
        this.contentType = null;
        this.mediaType = null;
        this.charSet = null;
        this.contentType = contentType;
        if (contentType) {
            this.withoutBoundary = contentType.replace(/;\s{0,}boundary.*/, '');
            this.mediaType = this.withoutBoundary.split(';')[0].trim();
            this.charSet = this.withoutBoundary.split(';')[1];
            if (this.charSet) {
                this.charSet = this.charSet.trim();
            }
        }
    }
    static from(req) {
        return new ContentType(req.headers['content-type']);
    }
    equivalents() {
        if (!this.withoutBoundary)
            return [];
        if (this.charSet) {
            return [this.mediaType, `${this.mediaType}; ${this.charSet}`];
        }
        return [this.withoutBoundary, `${this.mediaType}; charset=utf-8`];
    }
}
exports.ContentType = ContentType;
const _validationError = (status, path, message, errors) => {
    var _a;
    return ({
        status,
        errors: [
            Object.assign({ path,
                message }, (_a = { errors }, (_a !== null && _a !== void 0 ? _a : {}))),
        ],
    });
};
function validationError(status, path, message) {
    const err = _validationError(status, path, message);
    return ono_1.default(err, message);
}
exports.validationError = validationError;
/**
 * (side-effecting) modifies the errors object
 * TODO - do this some other way
 * @param errors
 */
function augmentAjvErrors(errors = []) {
    errors.forEach(e => {
        var _a;
        if (e.keyword === 'enum') {
            const params = e.params;
            const allowedEnumValues = (_a = params) === null || _a === void 0 ? void 0 : _a.allowedValues;
            e.message = !!allowedEnumValues
                ? `${e.message}: ${allowedEnumValues.join(', ')}`
                : e.message;
        }
    });
    return errors;
}
exports.augmentAjvErrors = augmentAjvErrors;
function ajvErrorsToValidatorError(status, errors) {
    return {
        status,
        errors: errors.map(e => {
            var _a, _b, _c, _d;
            const params = e.params;
            const required = ((_a = params) === null || _a === void 0 ? void 0 : _a.missingProperty) && e.dataPath + '.' + params.missingProperty;
            const additionalProperty = ((_b = params) === null || _b === void 0 ? void 0 : _b.additionalProperty) && e.dataPath + '.' + params.additionalProperty;
            const path = (_d = (_c = (required !== null && required !== void 0 ? required : additionalProperty), (_c !== null && _c !== void 0 ? _c : e.dataPath)), (_d !== null && _d !== void 0 ? _d : e.schemaPath));
            return {
                path,
                message: e.message,
                errorCode: `${e.keyword}.openapi.validation`,
            };
        }),
    };
}
exports.ajvErrorsToValidatorError = ajvErrorsToValidatorError;
exports.deprecationWarning = process.env.NODE_ENV !== 'production' ? console.warn : () => { };
//# sourceMappingURL=util.js.map