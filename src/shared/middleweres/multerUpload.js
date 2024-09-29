import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = "";

    if (!req.userdata || !req.userdata._id) {
      // Skip storing if user ID doesn't exist
      return cb(new Error("User ID not found, skipping photo storage"));
    }

    if (file.fieldname === "profileImage") {
      folder = "public/profileImages/";
    } else {
      folder = "public/others/";
    }

    // Create the folder if it doesn't exist
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    cb(null, folder);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

// Combined Multer upload and error handling middleware
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    cb(null, true);
  },
}).fields([
  { name: "profileImage", maxCount: 1 },
]);

// Combined middleware function
const handleUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(500).json(err);
    } else if (err) {
      return res.status(500).json(err);
    }

    next();
  });
};

export default handleUpload;
