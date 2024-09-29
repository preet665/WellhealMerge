const AWS = require('aws-sdk');

// Configure AWS with your access and secret key.
const s3 = new AWS.S3({
    accessKeyId: process.env.YOUR_ACCESS_KEY_ID,
    secretAccessKey: process.env.YOUR_SECRET_ACCESS_KEY
});


const fs = require('fs');

exports.uploadImage = (filePath, bucketName, key) => {
    // Read content from the file
    const fileContent = fs.readFileSync(filePath);

    // Setting up S3 upload parameters
    const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: key, // File name you want to save as in S3
        Body: fileContent,
        ContentType: 'image/jpeg' // Adjust according to the type of image
    };

    // Uploading files to the bucket
    s3.upload(params, function(err, data) {
        if (err) {
            throw err;
        }
        console.log(`File uploaded successfully. ${data.Location}`);
    });
};
