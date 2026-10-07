require('dotenv').config();
// ĐÓNG BĂNG VẤN ĐỀ DNS BẰNG CÁCH ÉP NODE.JS DÙNG DNS GOOGLE/CLOUDFLARE
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const express = require('express');
const { engine } = require('express-handlebars');
const session = require('express-session');
const connectMongo = require('connect-mongo');
const MongoStore = connectMongo.default || connectMongo;
const mongoose = require('mongoose');
const bookSchema = require('./models/Book');

const app = express();

// Middleware xử lý dữ liệu form
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cấu hình Handlebars Template Engine
app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', './views');

// --- TÍNH TOÁN THEO MSSV 23IT065 ---
const STUDENT_ID = '23IT065';
const PREFIX_REQUIRED = '065'; // 3 số cuối MSSV
const LAST_DIGIT = 5;          // Chữ số cuối MSSV
const VAT_RATE = LAST_DIGIT + 4; // VAT = (5 + 4) = 9%

// 1. ĐA LUỒNG KẾT NỐI MONGODB (READ / WRITE SEPARATION)
const readConn = mongoose.createConnection(process.env.MONGO_READ_URI);
const writeConn = mongoose.createConnection(process.env.MONGO_WRITE_URI);

readConn.on('connected', () => console.log('✅ Đã kết nối thành công luồng READ'));
writeConn.on('connected', () => console.log('✅ Đã kết nối thành công luồng WRITE'));

// Gán Schema vào 2 kết nối riêng biệt
const ReadBook = readConn.model('Book', bookSchema);
const WriteBook = writeConn.model('Book', bookSchema);

// 2. STATELESS SESSION - LƯU TẬP TRUNG XUỐNG CLOUD MONGO DB
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret_key_23IT065',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_WRITE_URI, // Dùng luồng write để ghi session
    collectionName: 'sessions'
  }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 ngày
}));

// --- ROUTES ---

// Route Xem Danh Sách (Sử dụng Luồng READ)
app.get('/', async (req, res) => {
  try {
    // Tăng lượt xem trong Session để kiểm tra Session Cloud hoạt động
    req.session.views = (req.session.views || 0) + 1;

    // Lấy danh sách sách từ luồng READ
    const books = await ReadBook.find().lean();

    res.render('home', {
      books,
      sessionViews: req.session.views,
      studentId: STUDENT_ID,
      vatRate: VAT_RATE,
      error: req.query.error,
      success: req.query.success
    });
  } catch (err) {
    res.status(500).send('Lỗi khi tải dữ liệu: ' + err.message);
  }
});

// Route Thêm Sách Mới (Sử dụng Luồng WRITE)
app.post('/books', async (req, res) => {
  try {
    const { productCode, title, price } = req.body;

    // BỘ LỌC 1: Kiểm tra tiền tố 3 số cuối MSSV (065)
    if (!productCode || !productCode.startsWith(PREFIX_REQUIRED)) {
      return res.redirect(`/?error=Mã sản phẩm bắt buộc phải bắt đầu bằng tiền tố ${PREFIX_REQUIRED}`);
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      return res.redirect('/?error=Giá gốc không hợp lệ');
    }

    // TÍNH TOÁN ĐỘNG: Tính giá sau thuế (VAT 9%)
    const priceAfterTax = numPrice * (1 + VAT_RATE / 100);

    // Ghi vào CSDL bằng luồng WRITE
    await WriteBook.create({
      productCode,
      title,
      price: numPrice,
      priceAfterTax: Math.round(priceAfterTax)
    });

    res.redirect('/?success=Thêm sách mới thành công!');
  } catch (err) {
    res.redirect(`/?error=Lỗi thêm sách: ${err.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});