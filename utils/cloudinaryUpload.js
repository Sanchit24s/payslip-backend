const cloudinary = require("../config/cloudinary");

async function uploadPDFToCloudinary(pdfBuffer, fileName, folderPath = "Payslips") {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                folder: folderPath,   // ✅ dynamic folder
                resource_type: "raw", // required for PDFs
                public_id: fileName.replace(/\.pdf$/, ""),
                format: "pdf",
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        ).end(pdfBuffer);
    });
}

module.exports = { uploadPDFToCloudinary };
