const config = {
    // Server
    port: process.env.PORT,

    node_env: process.env.NODE_ENV,
    client_url: process.env.CLIENT_URL,

    // SMTP Email Configuration
    smtp_host: process.env.SMTP_HOST,
    smtp_port: process.env.SMTP_PORT,
    smtp_secure: process.env.SMTP_SECURE === "true",
    smtp_user: process.env.SMTP_USER,
    smtp_pass: process.env.SMTP_PASS,

    google: {
        sheet_id: process.env.GOOGLE_SHEET_ID,
        drive_id: process.env.DRIVE_FOLDER_ID,
        credentials: process.env.GOOGLE_CREDENTIALS_BASE64
    },

    cloudinary: {
        name: process.env.CLOUD_NAME,
        api_key: process.env.CLOUD_API_KEY,
        api_secret: process.env.CLOUD_API_SECRET,
    },

    user: {
        email: process.env.EMAIL,
        password: process.env.PASSWORD
    },

    jwt_secret: process.env.JWT_SECRET,

};

module.exports = config;