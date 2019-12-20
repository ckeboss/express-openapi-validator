"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const multer = require('multer');
function multipart(OpenApiContext, multerOpts = {}) {
    const mult = multer(multerOpts);
    return (req, res, next) => {
        if (isMultipart(req) && isValidContentType(req)) {
            mult.any()(req, res, err => {
                if (err) {
                    next(error(req, err));
                }
                else {
                    // TODO:
                    // If a form parameter 'file' is defined to take file value, but the user provides a string value instead
                    // req.files will be empty and req.body.file will be populated with a string
                    // This will incorrectly PASS validation.
                    // Instead, we should return a 400 with an invalid type e.g. file expects a file, but found string.
                    //
                    // In order to support this, we likely need to inspect the schema directly to find the type.
                    // For example, if param with type: 'string', format: 'binary' is defined, we expect to see it in
                    // req.files. If it's not present we should throw a 400
                    //
                    // This is a bit complex because the schema may be defined inline (easy) or via a $ref (complex) in which
                    // case we must follow the $ref to check the type.
                    if (req.files) {
                        // to handle single and multiple file upload at the same time, let us this initialize this count variable
                        // for example { "files": 5 }
                        const count_by_fieldname = req.files
                            .map(file => file.fieldname)
                            .reduce((acc, curr) => {
                            acc[curr] = (acc[curr] || 0) + 1;
                            return acc;
                        }, {});
                        // add file(s) to body
                        Object
                            .entries(count_by_fieldname)
                            .forEach(([fieldname, count]) => {
                            // TODO maybe also check in the api doc if it is a single upload or multiple
                            const is_multiple = count > 1;
                            req.body[fieldname] = (is_multiple)
                                ? new Array(count).fill('')
                                : '';
                        });
                    }
                    next();
                }
            });
        }
        else {
            next();
        }
    };
}
exports.multipart = multipart;
function isValidContentType(req) {
    const contentType = req.headers['content-type'];
    return !contentType || contentType.includes('multipart/form-data');
}
function isMultipart(req) {
    var _a, _b, _c, _d, _e;
    return (_e = (_d = (_c = (_b = (_a = req) === null || _a === void 0 ? void 0 : _a.openapi) === null || _b === void 0 ? void 0 : _b.schema) === null || _c === void 0 ? void 0 : _c.requestBody) === null || _d === void 0 ? void 0 : _d.content) === null || _e === void 0 ? void 0 : _e['multipart/form-data'];
}
function error(req, err) {
    var _a;
    if (err instanceof multer.MulterError) {
        // distinguish common errors :
        // - 413 ( Request Entity Too Large ) : Too many parts / File too large / Too many files
        // - 400 ( Bad Request ) : Field * too long / Too many fields
        // - 500 ( Internal Server Error ) : Unexpected field
        const multerError = err;
        const payload_too_big = /LIMIT_(FILE|PART)_(SIZE|COUNT)/.test(multerError.code);
        const unexpected = /LIMIT_UNEXPECTED_FILE/.test(multerError.code);
        const status = payload_too_big ? 413 : !unexpected ? 400 : 500;
        return util_1.validationError(status, req.path, err.message);
    }
    else {
        // HACK
        // TODO improve multer error handling
        const missingField = /Multipart: Boundary not found/i.test((_a = err.message, (_a !== null && _a !== void 0 ? _a : '')));
        if (missingField) {
            return util_1.validationError(400, req.path, 'multipart file(s) required');
        }
        else {
            return util_1.validationError(500, req.path, err.message);
        }
    }
}
//# sourceMappingURL=openapi.multipart.js.map