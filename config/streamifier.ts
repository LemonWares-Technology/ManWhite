import cloudinary from "./cloudinary";
import streamifier from "streamifier";


function toNodeBuffer(bufferLike: any) {
  if (Buffer.isBuffer(bufferLike)) {
    return bufferLike; // already a Buffer
  }
  // Convert ArrayBuffer or TypedArray to Buffer
  return Buffer.from(bufferLike);
}

export const streamUpload = (file: Express.Multer.File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file?.buffer) {
      return reject(new Error("File buffer is missing"));
    }

    const buffer = toNodeBuffer(file.buffer);

    const stream = cloudinary.uploader.upload_stream(
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url) return reject(new Error("No secure_url returned"));
        resolve(result.secure_url);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};
