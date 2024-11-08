const express = require('express');
const multer = require('multer');
const File = require('../models/File');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');


const router = express.Router();

// Tạo thư mục nếu chưa tồn tại
router.post('/create-folder', (req, res) => {
  const { folderName } = req.body;
  const dirPath = path.join(__dirname, '..', 'uploads', folderName);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    return res.json({ success: true });
  }
  res.json({ success: false, message: 'Folder already exists' });
});

// Cấu hình multer để lưu file vào thư mục đã chọn
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.body.folder || 'default';
    const dirPath = path.join(__dirname, '..', 'uploads', folder);

    // Kiểm tra nếu thư mục không tồn tại thì tạo mới
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    cb(null, dirPath);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname); // Lấy phần mở rộng của file
    const filename = `${file.fieldname}-${Date.now()}${extension}`; // Tạo tên file mới với phần mở rộng
    cb(null, filename);
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100000 * 1024 * 1024 }
});

// Route tải lên nhiều file
router.post('/upload', upload.array('files', 1000), async (req, res) => {
  try {
    const folder = req.body.folder || 'default';

    // Duyệt qua tất cả các file đã tải lên và lưu thông tin vào MongoDB
    const files = req.files.map(file => ({
      filename: file.originalname,
      filepath: path.join('uploads', folder, file.filename).replace(/\\/g, '/'),
      size: file.size,
      filetype: file.mimetype.split('/')[0], // Xác định loại file
      uploadDate: new Date(),
    }));

    // Lưu danh sách file vào MongoDB
    await File.insertMany(files);
    res.redirect('/');
  } catch (err) {
    res.status(500).json({ message: 'Error uploading files', error: err });
  }
});

// Route tải danh sách file
router.get('/', async (req, res) => {
  try {
    const files = await File.find().sort({ uploadDate: -1 }); // Sắp xếp file mới nhất ở trên cùng
    res.json(files);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching files', error: err });
  }
});

// Route lấy danh sách thư mục
router.get('/folders', (req, res) => {
  const baseDir = path.join(__dirname, '..', 'uploads');
  const folders = fs.readdirSync(baseDir).filter(name => fs.statSync(path.join(baseDir, name)).isDirectory());
  res.json(folders);
});

// Route tải file về
router.get('/download/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid file ID' });
  }

  try {
    const file = await File.findById(id);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    const filePath = path.resolve(__dirname, '..', file.filepath);
    res.download(filePath, file.filename, (err) => {
      if (err) {
        console.error("Download error:", err.message);
        res.status(500).json({ message: 'Error downloading file', error: err.message });
      }
    });
  } catch (err) {
    console.error("Download route error:", err.message);
    res.status(500).json({ message: 'Error downloading file', error: err.message });
  }
});

// Route xóa file
router.delete('/delete/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid file ID' });
  }

  try {
    const file = await File.findById(id);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    const filePath = path.resolve(__dirname, '..', file.filepath);
    try {
      fs.unlinkSync(filePath);
    } catch (unlinkErr) {
      console.error("File deletion error:", unlinkErr.message);
      return res.status(500).json({ message: 'Error deleting file', error: unlinkErr.message });
    }
    // Xóa file khỏi database
    await File.findByIdAndDelete(id);
    res.status(200).json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error("Delete route error:", err.message);
    res.status(500).json({ message: 'Error deleting file', error: err.message });
  }
});

// Route lấy danh sách file và thư mục
router.get('/contents', async (req, res) => {
  const basePath = path.join(__dirname, '..', 'uploads', req.query.path || '');
  try {
    // Đọc thư mục để lấy danh sách thư mục con
    const items = fs.readdirSync(basePath);
    const folders = items.filter(item => fs.statSync(path.join(basePath, item)).isDirectory());

    // Định dạng đường dẫn thư mục trong MongoDB theo `dbPath`
    const dbPath = path.join('uploads', req.query.path || '').replace(/\\/g, '/');
    
    // Tìm các file thuộc thư mục hiện tại
    const filesFromDb = await File.find({ filepath: { $regex: `^${dbPath}/[^/]+$` } });

    // Định dạng file để trả về
    const files = filesFromDb.map(file => ({
      _id: file._id,
      filename: file.filename,
      filepath: `/${file.filepath}`.replace(/\\/g, '/')
    }));

    res.json({ folders, files });
  } catch (error) {
    res.status(500).json({ message: 'Error reading directory', error });
  }
});

// Route tạo thư mục
router.post('/create-folder', (req, res) => {
  const dirPath = path.join(__dirname, '..', 'uploads', req.body.path || '', req.body.folderName);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, message: 'Folder already exists' });
  }
});

module.exports = router;
