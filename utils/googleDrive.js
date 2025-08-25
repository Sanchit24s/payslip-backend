const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const stream = require("stream");
const logger = require("../config/logger");

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const CREDENTIALS_PATH = path.join(__dirname, "../credentials.json");

let driveClient;

/**
 * Authorize Google Drive API using credentials.json
 */
async function authorizeGoogleDrive() {
    if (driveClient) return driveClient;

    try {
        const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: SCOPES,
        });

        const drive = google.drive({ version: "v3", auth });
        driveClient = drive;
        return drive;
    } catch (error) {
        logger.error("Failed to authorize Google Drive API", error);
        throw error;
    }
}

/**
 * Create subfolder inside parent folder
 */
async function createSubfolder(folderName, parentFolderId) {
    const drive = await authorizeGoogleDrive();

    const fileMetadata = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
    };

    try {
        const folder = await drive.files.create({
            resource: fileMetadata,
            fields: "id, name",
        });

        logger.info(`✅ Folder created: ${folderName} (${folder.data.id})`);
        return folder.data.id;
    } catch (err) {
        logger.error("❌ Failed to create subfolder", err);
        throw err;
    }
}

/**
 * Upload PDF to specified folder
 */
async function uploadPDFToDrive(buffer, fileName, folderId) {
    const drive = await authorizeGoogleDrive();

    try {
        const res = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [folderId],
                mimeType: "application/pdf",
            },
            media: {
                mimeType: "application/pdf",
                body: Buffer.isBuffer(buffer)
                    ? fs.createReadStream(buffer)
                    : bufferToStream(buffer),
            },
            fields: "id, name, webViewLink, webContentLink",
        });

        logger.info(`📄 Uploaded: ${fileName} (${res.data.webViewLink})`);
        return res.data;
    } catch (err) {
        logger.error(`❌ Upload failed for ${fileName}`, err);
        throw err;
    }
}

/**
 * Convert buffer to stream
 */
function bufferToStream(buffer) {
    const readable = new stream.Readable();
    readable._read = () => { };
    readable.push(buffer);
    readable.push(null);
    return readable;
}

module.exports = {
    authorizeGoogleDrive,
    createSubfolder,
    uploadPDFToDrive,
};
