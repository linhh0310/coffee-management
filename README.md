# Coffee Management

Hệ thống quản lý quán cà phê gồm:
- **Backend**: Node.js + Express + MySQL
- **Frontend**: React

Dự án hỗ trợ quản lý sản phẩm, đơn hàng, bàn, khách hàng, người dùng, khuyến mãi, tồn kho và một số tính năng AI.

---

## 1) Công nghệ sử dụng

### Backend (`/backend`)
- Node.js
- Express
- MySQL (`mysql2`)
- JWT (`jsonwebtoken`)
- Bcrypt
- Dotenv

### Frontend (`/frontend`)
- React
- React Router
- Axios
- Framer Motion
- TailwindCSS (có cấu hình trong dự án)

---

## 2) Cấu trúc thư mục

```text
Coffee_Management/
├─ backend/
│  ├─ src/
│  │  ├─ controllers/
│  │  ├─ middlewares/
│  │  ├─ routes/
│  │  ├─ services/
│  │  └─ app.js
│  ├─ public/
│  ├─ .env.example
│  └─ package.json
├─ frontend/
│  ├─ public/
│  ├─ src/
│  └─ package.json
├─ database/
│  └─ coffee_db.sql
└─ README.md
```

---

## 3) Yêu cầu môi trường

- Node.js >= 18
- npm >= 9
- MySQL >= 8 (khuyến nghị)

---

## 4) Cài đặt và chạy dự án

### Bước 1: Clone repository

```bash
git clone https://github.com/linhh0310/coffee-management.git
cd coffee-management
```

### Bước 2: Cài đặt Backend

```bash
cd backend
npm install
```

### Bước 3: Cấu hình biến môi trường Backend

Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

Trên Windows PowerShell có thể dùng:

```powershell
Copy-Item .env.example .env
```

Sau đó cập nhật các giá trị trong `.env`:

```env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=coffee_management
PORT=5000
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

### Bước 4: Import database

- Mở MySQL Workbench/phpMyAdmin hoặc dùng CLI
- Import file: `database/coffee_db.sql`

### Bước 5: Chạy Backend

```bash
cd backend
npm run dev
```

Backend mặc định chạy tại: `http://localhost:5000`

### Bước 6: Cài đặt và chạy Frontend

```bash
cd frontend
npm install
npm start
```

Frontend mặc định chạy tại: `http://localhost:3000`

> Frontend đang cấu hình `proxy` về `http://localhost:5000` trong `frontend/package.json`.

### Lưu ý khi deploy Railway

Khi deploy tách riêng frontend và backend trên Railway, `proxy` trong `frontend/package.json` không còn tác dụng. Nếu frontend gọi API dạng `/api/...` mà không cấu hình thêm, request sẽ đi về domain frontend và dễ gặp lỗi `404`.

Cần thêm biến môi trường cho service frontend:

```env
REACT_APP_API_URL=https://your-backend-service.up.railway.app
```

Thay `https://your-backend-service.up.railway.app` bằng domain backend thật trên Railway, sau đó redeploy frontend. Không thêm dấu `/` ở cuối URL.

Backend cũng cần có biến môi trường:

```env
JWT_SECRET=change_this_to_a_long_random_secret
```

Nếu thiếu `JWT_SECRET`, các API đăng nhập/đăng ký có thể lỗi `500` vì không ký được token.

Các endpoint auth đang dùng:

- Nhân viên: `POST /api/auth/login`, `POST /api/auth/register`
- Khách hàng: `POST /api/customers/auth/login`, `POST /api/customers/auth/register`

---

## 5) API chính (Backend)

Base URL: `http://localhost:5000`

Một số route chính:
- `POST /api/auth/...`
- `GET|POST|PUT|DELETE /api/products/...`
- `GET|POST|PUT|DELETE /api/orders/...`
- `GET|POST|PUT|DELETE /api/tables/...`
- `GET|POST|PUT|DELETE /api/users/...`
- `GET|POST|PUT|DELETE /api/customers/...`
- `GET|POST|PUT|DELETE /api/promotions/...`
- `GET|POST|PUT|DELETE /api/ingredients/...`
- `POST /api/ai/...`

Static files:
- `GET /public/...`
- `GET /uploads/...`

---

## 6) Scripts hữu ích

### Backend

```bash
npm start      # chạy production
npm run dev    # chạy với nodemon
```

### Frontend

```bash
npm start      # chạy development
npm run build  # build production
npm test       # chạy test
```

---

## 7) Lưu ý bảo mật

- **Không commit file `.env`**.
- Nếu từng lộ secret (DB password, JWT secret, API key), hãy đổi ngay.
- `.gitignore` đã cấu hình để bỏ qua `.env` và `node_modules`.

---

## 8) Đóng góp

1. Fork dự án
2. Tạo branch mới: `feature/ten-tinh-nang`
3. Commit thay đổi
4. Push branch
5. Tạo Pull Request

---

## 9) Liên hệ

Repository: https://github.com/linhh0310/coffee-management
