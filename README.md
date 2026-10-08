# FreshSight

A smart-fridge assistant. Upload a photo of your fridge and FreshSight detects the fruit in it, decides whether each piece is fresh or rotten, tracks stock against the quantities you want to keep, raises alerts, looks up live prices for anything running low, and suggests recipes.

## Features

- **Fruit detection** – a fine-tuned YOLOv8s model finds apples, bananas and oranges in a photo.
- **Freshness classification** – a fine-tuned MobileNetV3-small labels each detected fruit as fresh or rotten.
- **Inventory tracking** – compares fresh counts against per-item target quantities and marks each item `IN_STOCK`, `LOW_STOCK` or `OUT_OF_STOCK`.
- **Alerts** – automatic rotten, low-stock and out-of-stock alerts.
- **Smart shopping** – Playwright scrapers fetch live prices from grocery apps (Instamart and DMart return results reliably; Blinkit and JioMart are hit-or-miss). Results are cached in MongoDB, and clearly-marked mock prices are used only if every store fails.
- **Recipe generator** – Google Gemini suggests a recipe and lists which ingredients you have and which are missing (built-in sample recipes are used if no API key is set).
- **Scan history** – the dashboard lists your most recent scans.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, React Router, Recharts, lucide-react |
| Backend | Python, FastAPI, Uvicorn, Pydantic |
| Database | MongoDB (PyMongo) |
| Vision / ML | Ultralytics YOLOv8, PyTorch, TorchVision (MobileNetV3), OpenCV, Pillow, NumPy |
| Scraping | Playwright (Chromium), fuzzywuzzy |
| Recipes | Google Gemini (`google-generativeai`) |

## Project structure

```
FreshSight/
├── run.py                  # backend launcher (see "Running" below)
├── start.bat               # Windows helper that starts both servers
├── backend/
│   ├── main.py             # FastAPI app and startup
│   ├── config.py           # settings, class names, default targets
│   ├── database.py         # MongoDB connection and seeding
│   ├── routers/            # food.py
│   ├── services/           # detection, scraping, recipe services
│   ├── scrapers/           # Blinkit, DMart, Instamart, JioMart, ...
│   ├── models/             # trained weights and class names
│   └── requirements.txt
└── frontend/
    └── src/pages/          # Dashboard, Inventory, Alerts, SmartShopping,
                            # RecipeGenerator
```

## Prerequisites

- **Python 3.12 or newer** (developed on 3.12; also runs on 3.13)
- **Node.js 18+** and npm
- **MongoDB** running on `localhost:27017` (a local install, MongoDB Atlas, or Docker – see below)
- **A Gemini API key** (optional – only needed for recipe generation)
- Roughly 2 GB of free disk space for PyTorch and the Chromium browser used by the scrapers

## Setup

### 1. Get the code

The backend and frontend live in separate repositories. Clone both into one parent folder so they sit side by side as `backend/` and `frontend/`:

```bash
mkdir FreshSight && cd FreshSight
git clone https://github.com/Janmejay-05/firdgeiq-backend.git backend
git clone https://github.com/Janmejay-05/fridgeiq-frontend.git frontend
```

`run.py` and `start.bat` are at the project root next to those two folders.

### 2. Start MongoDB

With Docker:

```bash
docker run -d --name freshsight-mongo -p 27017:27017 mongo:7
```

Or use an existing local installation or an Atlas connection string (set it in `.env`, below).

### 3. Configure the backend

Create `backend/.env`:

```env
MONGO_URI=mongodb://localhost:27017
DB_NAME=fridgeiq
GEMINI_API_KEY=your-key-here
# Optional
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
MAX_UPLOAD_MB=10
DETECTION_CONF=0.46
```

See `backend/.env.example`. To point the frontend at a different backend, set `VITE_API_URL` in `frontend/.env`.

`GEMINI_API_KEY` can be left empty; recipes then fall back to built-in samples. Never commit this file.

### 4. Install backend dependencies

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
python -m playwright install chromium
```

The trained model files must be present in `backend/models/`:
`fruit_detector.pt`, `freshness_classifier.pt` and `class_names.json`.

### 5. Install frontend dependencies

```bash
cd frontend
npm install
```

## Running

Run the two servers in separate terminals.

**Both at once (Windows):** run `start.bat` from the project root.

**Backend** (from the project root):

```bash
python run.py
```

**Frontend** (from the `frontend/` folder):

```bash
npm run dev
```

Then open:

- App: http://127.0.0.1:5173
- API docs: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health

## Using the app

1. **Dashboard** – upload a photo of your fridge. The annotated result shows fresh items in green and rotten ones in red.
2. **Inventory** – set the target quantity for each item (defaults: apple 5, banana 4, orange 4).
3. **Alerts** – review rotten, low-stock and out-of-stock warnings.
4. **Smart Shopping** – see prices for items that need restocking. The first lookup for an item takes about 45 seconds; results are then cached for 6 hours.
5. **Recipes** – enter a dish name to get a recipe and a list of missing ingredients.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/food/scan-food` | Detect and classify fruit in an uploaded image |
| GET | `/api/food/dashboard-stats` | Totals for fresh, rotten, low and out-of-stock |
| GET | `/api/food/inventory` | Items with target and current quantities |
| POST / DELETE | `/api/food/default-item[/{name}]` | Add, update or remove a tracked item |
| GET | `/api/food/alerts` | Current alerts |
| GET | `/api/food/recommendations[/{item}]` | Shopping price recommendations |
| POST | `/api/food/generate-recipe` | Recipe for a dish |
| GET | `/api/food/scan-history` | Most recent scans |

## Models

- **Detector:** YOLOv8s fine-tuned (50 epochs, 640 px) on a merged fruit dataset for three classes: apple, banana, orange. Reported validation metrics: precision 0.95, recall 0.92, mAP@50 0.97.
- **Freshness classifier:** MobileNetV3-small fine-tuned at 224 px on six classes (fresh and rotten apples, bananas, oranges).

Only apples, bananas and oranges are supported end to end. 

## Known limitations

- **Scraping is best-effort.** It depends on third-party sites that can block automated browsers or change their layout. JioMart currently returns no results, and Blinkit's search for fruit is dominated by unrelated products, which the relevance filter discards. If every store fails, mock prices are returned and flagged with `"source": "mock"`.
- **Not deployed.** The frontend calls `http://127.0.0.1:8000` by default and CORS is restricted to the local Vite origins by default, so it is built for local use. Deploying would need a hosted MongoDB, production CORS settings and authentication (the API URL is configurable via `VITE_API_URL`).
- **No login.** Anyone who can reach the API can modify inventory.
- **Image uploads** must be JPEG, PNG, WebP or BMP and under `MAX_UPLOAD_MB` (default 10 MB).
- **Windows-oriented.** The launch scripts and the Playwright event-loop fix target Windows.

## Screenshots

_Add screenshots of the Dashboard, Inventory and Smart Shopping pages here._

## Author

Param Parmar
