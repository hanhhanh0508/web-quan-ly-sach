const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  productCode: { type: String, required: true }, // Mã sản phẩm (Bắt buộc bắt đầu bằng 065)
  title: { type: String, required: true },       // Tên sách
  price: { type: Number, required: true },       // Giá gốc
  priceAfterTax: { type: Number },               // Giá sau thuế (Tự động tính)
  createdAt: { type: Date, default: Date.now }
});

module.exports = bookSchema;