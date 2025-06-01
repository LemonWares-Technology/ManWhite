"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamUpload = void 0;
const cloudinary_1 = __importDefault(require("./cloudinary"));
const streamifier_1 = __importDefault(require("streamifier"));
const streamUpload = (req) => {
    return new Promise((resolve, reject) => {
        var _a;
        if (!((_a = req.file) === null || _a === void 0 ? void 0 : _a.buffer)) {
            resolve(null);
        }
        const stream = cloudinary_1.default.uploader.upload_stream((error, result) => {
            if (result) {
                resolve(result);
            }
            else {
                reject(error);
            }
        });
        streamifier_1.default.createReadStream(req.file.buffer).pipe(stream);
    });
};
exports.streamUpload = streamUpload;
