const express = require('express');
const cors = require('cors');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const tablesRoutes = require('./routes/tablesRoutes');
const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customerRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const aiRoutes = require('./routes/aiRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const chatRoutes = require('./routes/chatRoutes');
const path = require('path');
require('dotenv').config();

const app = express();
app.use('/public', express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use(cors());
app.use(express.json());
app.use('/api/auth', require('./routes/authRoutes'));
// Sử dụng Routes
app.use('/api/products', productRoutes);
app.use('/api/ingredients', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/chat', chatRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server chạy tại: http://localhost:${PORT}`);
});