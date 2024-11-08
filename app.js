const express = require('express');
const mongoose = require('mongoose');
const fileRoutes = require('./routes/fileRoutes');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(express.json());

// Cấu hình để phục vụ các file trong thư mục uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Cấu hình EJS làm view engine
app.set('view engine', 'ejs');

// Sử dụng route để tải file
app.use('/api/files', fileRoutes);

// Trang chủ để tải lên file
app.get('/', (req, res) => {
  res.render('index'); // Render trang index.ejs
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.log('MongoDB connection error:', err));

app.listen(process.env.PORT, () => {
  console.log(`Server is running on http://localhost:${process.env.PORT}`);
});