import cloudinary from "./cloudinary";
import streamifier from "streamifier";

export const streamUpload = (req: any): Promise<any | null> => {
    return new Promise((resolve, reject) => {
        if (!req.file?.buffer) {
            resolve(null)
        }

        const stream = cloudinary.uploader.upload_stream((error: any, result: any) => {
            if (result) {
                resolve(result)
            } else {
                reject(error)
            }
        })
        streamifier.createReadStream(req.file.buffer).pipe(stream)
    })
}