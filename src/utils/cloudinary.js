import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload a file
const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        // Upload file on Cloudinary
        const uploadResult = cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });
        console.log(
            "File uploaded successfully on Cloudinary: ",
            (await uploadResult).url
        );
        return uploadResult;
    } catch (error) {
        console.error("Error uploading file to Cloudinary:", error);
        fs.unlinkSync(localFilePath); // remove file from server
        return null;
    }
};

export default uploadOnCloudinary;
