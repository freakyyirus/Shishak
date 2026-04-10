# ShikShak Offline Setup & Execution Guide

This guide will walk you through running the ShikShak AI Platform 100% locally and offline without requiring internet access.

## Prerequisites

1.  **Ollama**: Installed and running on your local machine. ([Download Ollama](https://ollama.com/download))
2.  **Node.js**: Installed (v18+ recommended)
3.  **Python & NLLB-200**: Python environment setup with transformers (for NLLB translation).
4.  **MongoDB**: Installed and running locally.
5.  **ChromaDB**: Installed and running locally.

---

## 1. Configure Local Environment Variables

Edit your `backend/.env` (or `backend/src/config/env.ts` directly) to ensure it does not rely on external cloud keys. In the codebase, it is hardcoded to offline if you change settings appropriately.

Ensure the following variables are set to force local infrastructure:
```env
# Ollama Local Configuration
OLLAMA_URL="http://localhost:11434"
OLLAMA_CHAT_MODEL="deepseek-r1:1.5b" # Extremely fast offline model
OLLAMA_EMBED_MODEL="embeddinggemma:latest"

# Local translation via NLLB Python server
NLLB_ENABLED="true"

# Local Databases
MONGODB_URI="mongodb://localhost:27017/masterg"
CHROMA_URL="http://localhost:8000"
```

## 2. Pull Required AI Models

Open your terminal or command prompt, ensure Ollama is running in your task tray, and pull the offline models:

```bash
# 1. Pull the chat model (DeepSeek R1 1.5B is incredibly fast locally)
ollama pull deepseek-r1:1.5b

# 2. Pull the embedding model (Required for RAG & Uploads)
ollama pull embeddinggemma:latest
```

## 3. Verify NLLB Model (Offline Translation)

Ensure the NLLB model `nllb-200-distilled-600M` has been fully downloaded and exists in the `backend/proxy/models/nllb-200-distilled-600M` folder.

If your Python environment is set up successfully, the backend will spawn this model automatically on startup.

---

## 4. Launching the Platform

### Step 1: Start ChromaDB
In a new terminal:
```bash
chroma run --path ./chroma_data --port 8000
```
*(Assumes `chroma` is installed via pip)*

### Step 2: Start MongoDB
Ensure your MongoDB local service is running (usually automatic on Windows via Services, or use MongoDB Compass to verify).

### Step 3: Start Node Backend
In the `backend/` directory:
```bash
npm run dev
```
*Wait until you see:*
`✅ Connected to MongoDB`
`✅ ChromaDB collection ready`
`🚀 Starting NLLB-200 persistent server...`
`✅ Using NLLB venv Python`

### Step 4: Start React Frontend
In the `frontend/` directory:
```bash
npm run dev
```

---

## 5. Hackathon Judge Demo Tips

If you must run this locally to show the judges:
*   Make sure **Windows is plugged into power**. Running on battery saves power by throttling the CPU/GPU and makes offline AI extremely slow.
*   **Force High Performance**: Go to Windows `Graphics Settings`, add `ollama.exe`, and bind it to your **NVIDIA RTX GPU**.
*   In the frontend, verify the **"Local"** generation tab is enabled if your UI provides a Cloud/Local toggle.
*   Try a test run to ensure `deepseek-r1:1.5b` responds near-instantly. If it does not, Ollama is likely stuck on your CPU. Restart Ollama or use `qwen2.5:0.5b` (a tiny 400MB model) as an emergency fast fallback.
