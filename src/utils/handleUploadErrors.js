const multer = require('multer');

const handleUploadErrors = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds limit of 10MB',
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Multer error',
        error: err.message,
      });
    } else if (err) {
      // Any other error
      return res.status(400).json({
        success: false,
        message: 'File upload failed',
        error: err.message,
      });
    }

    next(); // No error, proceed
  });
};

module.exports = handleUploadErrors;
