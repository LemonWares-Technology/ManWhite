"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamUpload = void 0;
const cloudinary_1 = __importDefault(require("./cloudinary"));
const streamifier_1 = __importDefault(require("streamifier"));
function toNodeBuffer(bufferLike) {
    if (Buffer.isBuffer(bufferLike)) {
        return bufferLike; // already a Buffer
    }
    // Convert ArrayBuffer or TypedArray to Buffer
    return Buffer.from(bufferLike);
}
const streamUpload = (file) => {
    return new Promise((resolve, reject) => {
        if (!(file === null || file === void 0 ? void 0 : file.buffer)) {
            return reject(new Error("File buffer is missing"));
        }
        const buffer = toNodeBuffer(file.buffer);
        const stream = cloudinary_1.default.uploader.upload_stream((error, result) => {
            if (error)
                return reject(error);
            if (!(result === null || result === void 0 ? void 0 : result.secure_url))
                return reject(new Error("No secure_url returned"));
            resolve(result.secure_url);
        });
        streamifier_1.default.createReadStream(buffer).pipe(stream);
    });
};
exports.streamUpload = streamUpload;
