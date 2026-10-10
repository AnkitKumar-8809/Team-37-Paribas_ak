# Concurrent File Monitoring MVP

A high-throughput, concurrent file monitoring and validation system built for a 24-hour hackathon. The system tracks file uploads, batch streaming progress, exception rejections, and ML-assisted anomaly detection in real-time.

---

## 🛠 Tech Stack

- **Frontend**: React + Vite + TypeScript + Vanilla CSS + Socket.IO Client
- **Backend**: Node.js + Express + TypeScript + Socket.IO
- **Database**: PostgreSQL + Prisma ORM
- **ML Service**: Python + FastAPI + pandas + scikit-learn + RapidFuzz
- **Orchestration**: Docker Compose (PostgreSQL)

---

## 📁 Project Structure

```
concurrent-file-monitoring/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DashboardCards.tsx
│   │   │   ├── FileTable.tsx
│   │   │   ├── FileProgress.tsx
│   │   │   ├── RejectionTable.tsx
│   │   │   ├── AnomalyPanel.tsx
│   │   │   └── ResolutionModal.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── FileDetails.tsx
│   │   │   └── ResolutionCentre.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── hooks/
│   │   │   └── useRealtimeFiles.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── .env.example
│   └── .env
│
├── backend/
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/
│   │   │   ├── files.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── resolutions.ts
│   │   │   └── analytics.ts
│   │   ├── controllers/
│   │   │   ├── fileController.ts
│   │   │   ├── dashboardController.ts
│   │   │   └── resolutionController.ts
│   │   ├── services/
│   │   │   ├── ingestion.ts
│   │   │   ├── classifier.ts
│   │   │   ├── processor.ts
│   │   │   ├── validator.ts
│   │   │   ├── loader.ts
│   │   │   └── mlClient.ts
│   │   ├── workers/
│   │   │   └── fileWorker.ts
│   │   ├── db/
│   │   │   └── prisma.ts
│   │   ├── sockets/
│   │   │   └── socket.ts
│   │   ├── utils/
│   │   │   ├── hash.ts
│   │   │   ├── fileUtils.ts
│   │   │   └── logger.ts
│   │   └── types/
│   │       └── index.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── uploads/
│   ├── quarantine/
│   ├── processed/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── .env
│
├── ml-service/
│   ├── app/
│   │   ├── main.py
│   │   ├── routes/
│   │   │   ├── anomaly.py
│   │   │   ├── prediction.py
│   │   │   └── suggestions.py
│   │   ├── services/
│   │   │   ├── anomaly_detector.py
│   │   │   ├── time_predictor.py
│   │   │   └── suggestion_engine.py
│   │   ├── models/
│   │   │   ├── anomaly_model.pkl
│   │   │   └── time_model.pkl
│   │   └── utils/
│   │       └── preprocessing.py
│   ├── training/
│   │   ├── train_anomaly.py
│   │   └── train_time_model.py
│   ├── requirements.txt
│   ├── .env.example
│   └── .env
│
├── data/
│   ├── sample-files/
│   │   └── sample_transactions.csv
│   └── master-data/
│       ├── currencies.csv
│       ├── accounts.csv
│       └── ifsc.csv
│
├── scripts/
│   ├── generateTestFiles.ts
│   └── setupDatabase.ts
│
├── docker-compose.yml
├── README.md
└── .gitignore
```

---

## ⚡ Quick Start & Installation

### 1. Database (Optional Docker)
```bash
docker-compose up -d postgres
```

### 2. Frontend Installation
```bash
cd frontend
npm install
```

### 3. Backend Installation
```bash
cd backend
npm install
npx prisma generate
```

### 4. ML Service Installation
```bash
cd ml-service
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate
pip install -r requirements.txt
```

---

## 🚀 Running the Services

### 1. Run Frontend (Port 5173)
```bash
cd frontend
npm run dev
```

### 2. Run Backend (Port 5000)
```bash
cd backend
npm run dev
```

### 3. Run ML Service (Port 8000)
```bash
cd ml-service
# with virtual environment activated:
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🌐 Network & CORS Setup

- **Frontend**: Runs on `http://localhost:5173`
- **Backend**: Runs on `http://localhost:5000` (Socket.IO enabled, CORS allowed from `http://localhost:5173`)
- **FastAPI ML Service**: Runs on `http://localhost:8000` (CORS allowed from `http://localhost:5173` and `http://localhost:5000`)
