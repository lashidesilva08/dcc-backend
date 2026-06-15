import multer from 'multer';
import path from 'path';

// 1. Standard disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Default fallback folder
    let folder = 'uploads/';

    // Dynamically route based on the endpoint URL string
    if (req.originalUrl.includes('products') || req.originalUrl.includes('listings')) {
      folder = 'uploads/products/';
    } else if (req.originalUrl.includes('users') || req.originalUrl.includes('auth')) {
      folder = 'uploads/users/';
    }

    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// 2. The File Filter function (Validates type)
const fileFilter = (req, file, cb) => {
  // Allowed file extensions
  const allowedFileTypes = /jpeg|jpg|png|webp/;
  
  // Check the extension name
  const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  // Check the mime type (e.g., image/jpeg)
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true); // Accept the file
  } else {
    // Reject the file with an error message
    cb(new Error('Only images (.jpeg, .jpg, .png, .webp) are allowed!'), false);
  }
};

// 3. Combine everything into the upload middleware
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB in bytes
  }
});