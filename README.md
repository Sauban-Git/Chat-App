# 📱💬 ChatApp

A full-stack **real-time chat application** built with:

- **Frontend (Mobile/Web):** React + Vite + TypeScript  
- **Backend (Server):** Node.js + Express + Prisma + PostgreSQL + Redis + WebSockets  

---

## 🚀 Features
- 🔐 User authentication with JWT  
- 💬 Real-time messaging with WebSockets  
- 👀 User presence tracking (online/offline)  
- 📜 Message status indicators (sent, delivered, read)  
- 🗂 Conversation list and user info management  
- ⚡ Optimized state management with Zustand  
- 🎨 Modern UI with React + Tailwind  

---

## 📂 Project Structure

```
ChatApp/
├── mobile/        # React + Vite frontend
│   ├── src/       # Components, hooks, stores, utils
│   ├── public/    # Static assets
│   └── .env.example
│
└── server/        # Express + Prisma + WebSocket backend
    ├── src/       # Routes, middleware, socket handlers
    ├── prisma/    # DB schema & migrations
    └── .env.example
```

---

## ⚙️ Setup

### 1. Clone the repo
```bash
git clone https://github.com/your-username/ChatApp.git
cd ChatApp
```

---

### 2. Backend Setup (`server/`)

#### Install dependencies
```bash
cd server
npm install
```

#### Configure environment
Create a `.env` file in `server/` based on `.env.example`:

```env
PORT=3000
JWT_SECRET=your-secret
SECURE=false
SAME_SITE=lax
HTTP_ONLY=true
REDIS_URL=redis://localhost:6379
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
```

#### Run database migrations
```bash
npx prisma migrate dev
```

#### Start the backend
```bash
npm run dev
```
Backend runs at **http://localhost:3000**

---

### 3. Frontend Setup (`mobile/`)

#### Install dependencies
```bash
cd mobile
npm install
```

#### Configure environment
Create a `.env` file in `mobile/` based on `.env.example`:

```env
VITE_SERVER_URL=http://localhost:3000
```

#### Start the frontend
```bash
npm run dev
```
Frontend runs at **http://localhost:5173**

---

## 🔌 Tech Stack

### Frontend
- React (TypeScript)
- Vite
- Zustand (state management)
- Axios (API requests)
- Tailwind CSS

### Backend
- Node.js + Express
- Prisma ORM (PostgreSQL)
- Redis (caching & pub/sub)
- JWT Authentication
- WebSockets (real-time messaging)

---

## 📜 Available Scripts

### Backend (`server/`)
- `npm run dev` → Start development server
- `npm run build` → Build TypeScript to `dist/`
- `npm start` → Run compiled server
- `npx prisma migrate dev` → Run DB migrations
- `npx prisma studio` → Open Prisma DB GUI

### Frontend (`mobile/`)
- `npm run dev` → Start dev server
- `npm run build` → Build production files
- `npm run preview` → Preview production build

---

## 🛠️ Database

Default database: **PostgreSQL**  
Migrations are managed with **Prisma**.  
To view/edit data:

```bash
npx prisma studio
```

---

## 📡 WebSocket Events

- **connection** → User connects to server  
- **message:new** → New message sent  
- **message:status** → Update message status (sent/delivered/read)  
- **user:presence** → User online/offline updates
