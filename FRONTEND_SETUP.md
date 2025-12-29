# Basehook Frontend Setup

## What Was Built

A complete web dashboard for monitoring webhook thread updates with:

- **Data Table**: Displays webhook updates with pagination
- **Filters**: Search, webhook name filter, and status filter
- **Toolbar**: Refresh button and filter controls
- **Responsive Design**: Works on desktop and mobile
- **Real-time Updates**: Fetch latest data from backend API

## Tech Stack

- React Router 7
- Tailwind CSS 4
- shadcn/ui components
- TypeScript
- Lucide icons

## Quick Start

### 1. Install Dependencies

```bash
cd frontend/app
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:5173`

### 3. Start the Backend (in another terminal)

```bash
# From project root
cd /Users/mehdi/Workspace/basehook

# Activate venv
source .venv/bin/activate

# Set database URL
export DATABASE_URL="postgresql+asyncpg://chiefskiss:chiefskiss@localhost:5445/postgres"

# Run FastAPI backend
uvicorn basehook.api:app --reload
```

Backend runs on `http://localhost:8000`

## File Structure

```
frontend/app/
├── app/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── table.tsx
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   └── badge.tsx
│   │   └── webhook-table.tsx      # Main data table with filters
│   ├── routes/
│   │   ├── home.tsx               # Dashboard page
│   │   └── api.thread-updates.ts  # API proxy route
│   ├── lib/
│   │   └── utils.ts               # Utilities
│   └── app.css                    # Global styles
├── package.json
└── components.json                 # shadcn config
```

## Features

### Dashboard Page (`routes/home.tsx`)

- Fetches data from `/api/thread-updates`
- Displays thread updates in a table
- Auto-refresh functionality
- Loading states

### Webhook Table Component (`components/webhook-table.tsx`)

- **Search**: Filter by thread ID or webhook name
- **Webhook Filter**: Dropdown to filter by specific webhook
- **Status Filter**: Filter by PENDING, SUCCESS, ERROR, SKIPPED
- **Sortable columns**: All columns are displayed clearly
- **JSON content**: Pretty-printed JSON for each update
- **Timestamps**: Human-readable date/time formatting
- **Status badges**: Color-coded for each status type

### API Route (`routes/api.thread-updates.ts`)

- Server-side route that proxies requests to Python backend
- Can be configured via `BACKEND_URL` environment variable
- Currently returns mock data (ready to connect to real backend)

### Backend API (`src/basehook/api.py`)

- New `GET /api/thread-updates` endpoint
- Returns latest 100 updates from database
- Properly formats enum values for JSON response

## Connecting Frontend to Backend

The frontend is configured to call `/api/thread-updates` which proxies to the Python backend.

### Option 1: Update Frontend API Route

Edit `frontend/app/app/routes/api.thread-updates.ts`:

```typescript
const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
const response = await fetch(`${backendUrl}/api/thread-updates`)
const data = await response.json()
return Response.json(data)
```

### Option 2: Direct Backend Call

Edit `frontend/app/app/routes/home.tsx`:

```typescript
const response = await fetch('http://localhost:8000/api/thread-updates')
```

Note: This requires CORS configuration on the backend.

## CORS Configuration (if needed)

Add to `src/basehook/api.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Build for Production

```bash
cd frontend/app
npm run build
npm run start
```

## Environment Variables

- `BACKEND_URL`: URL of Python FastAPI backend (default: `http://localhost:8000`)
- `NODE_ENV`: Set to `production` for production builds

## Next Steps

1. **Add Pagination**: Implement server-side pagination for large datasets
2. **Real-time Updates**: Add WebSocket support for live updates
3. **Detail View**: Click on a row to see full thread history
4. **Export**: Add CSV/JSON export functionality
5. **Date Range Filter**: Filter by timestamp range
6. **Error Handling**: Better error messages and retry logic
7. **Dark Mode**: Toggle between light and dark themes
8. **Authentication**: Add user authentication if needed

## Troubleshooting

### Frontend can't reach backend

1. Verify backend is running: `curl http://localhost:8000/api/thread-updates`
2. Check CORS settings
3. Verify `BACKEND_URL` environment variable

### Styles not loading

1. Run `npm install` to ensure dependencies are installed
2. Restart dev server
3. Clear browser cache

### Data not displaying

1. Check browser console for errors
2. Verify backend returns correct JSON format
3. Check network tab in browser dev tools
