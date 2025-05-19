const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Allowed image file types
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];

/**
 * Saves a single file to the specified directory
 * @param {Object} file - The file object from multer
 * @param {string} directory - The target directory (e.g., 'categories', 'products')
 * @returns {Promise<string>} The saved file path relative to uploads directory
 */
const saveSingleFile = async (file, directory) => {
  if (!file) throw new Error('No file provided');
  
  // Validate file type
  if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only image files are allowed.');
  }

  // Create base uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }

  // Create specific directory if it doesn't exist
  const targetDir = path.join(uploadsDir, directory);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Generate unique filename
  const fileExt = path.extname(file.originalname);
  const fileName = `${path.parse(file.originalname).name}_${uuidv4().slice(0, 8)}${fileExt}`;
  const filePath = path.join(targetDir, fileName);

  // Save file
  await fs.promises.writeFile(filePath, file.buffer);

  // Return relative path from uploads directory
  return `/uploads/${directory}/${fileName}`;
};

/**
 * Saves multiple files to the specified directory
 * @param {Array} files - Array of file objects from multer
 * @param {string} directory - The target directory (e.g., 'categories', 'products')
 * @returns {Promise<Array<string>>} Array of saved file paths relative to uploads directory
 */
const saveMultipleFiles = async (files, directory) => {
  if (!Array.isArray(files)) throw new Error('Files must be an array');
  
  const savedPaths = await Promise.all(
    files.map(file => saveSingleFile(file, directory))
  );

  return savedPaths;
};

/**
 * Deletes a file from the uploads directory
 * @param {string} filePath - The relative path of the file to delete
 * @returns {Promise<void>}
 */
const deleteFile = async (filePath) => {
  if (!filePath) return;

  const fullPath = path.join(process.cwd(), filePath.replace(/^\/+/, ''));
  
  try {
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
};

module.exports = {
  saveSingleFile,
  saveMultipleFiles,
  deleteFile,
  ALLOWED_FILE_TYPES
}; 