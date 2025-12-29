# Basehook Web UI

A modern web dashboard for monitoring webhook thread updates built with React Router, Tailwind CSS, and shadcn/ui.

## Features

- **Real-time Dashboard**: Monitor webhook updates and thread status
- **Advanced Filtering**: Filter by webhook name, status, or search by thread ID
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Status Indicators**: Color-coded badges for SUCCESS, PENDING, ERROR, and SKIPPED states
- **Auto-refresh**: Manually refresh data with a single click

## Tech Stack

- **React Router 7**: Modern routing and data loading
- **Tailwind CSS 4**: Utility-first CSS framework
- **shadcn/ui**: High-quality React components
- **Lucide Icons**: Beautiful, consistent icons
- **TypeScript**: Type-safe development

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
cd frontend/app
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run start
```

## Project Structure

```
app/
├── components/
│   ├── ui/              # shadcn/ui components
│   │   ├── table.tsx
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   └── badge.tsx
│   └── webhook-table.tsx # Main data table component
├── routes/
│   ├── home.tsx         # Dashboard page
│   └── api.thread-updates.ts # API route for data fetching
├── lib/
│   └── utils.ts         # Utility functions
└── app.css              # Global styles

```

## Components

### WebhookTable

The main table component with filtering capabilities.

**Props:**
- `updates`: Array of thread update objects
- `onRefresh`: Callback function for refresh button
- `loading`: Boolean to show loading state

**Features:**
- Search by thread ID or webhook name
- Filter by webhook name dropdown
- Filter by status (PENDING, SUCCESS, ERROR, SKIPPED)
- Displays formatted JSON content
- Shows human-readable timestamps

## API Integration

### Current Setup (Mock Data)

The app currently uses mock data defined in `routes/api.thread-updates.ts`.

### Connecting to Real Backend

To connect to the actual Python FastAPI backend:

1. **Add a GET endpoint to your FastAPI app** (`src/basehook/api.py`):

```python
@app.get("/api/thread-updates")
async def get_thread_updates():
    async with get_engine().begin() as conn:
        result = await conn.execute(
            select(thread_update_table)
            .order_by(thread_update_table.c.timestamp.desc())
            .limit(100)
        )
        updates = result.all()

        return [
            {
                "id": f"{u.webhook_name}-{u.thread_id}-{u.revision_number}",
                "webhook_name": u.webhook_name,
                "thread_id": u.thread_id,
                "revision_number": u.revision_number,
                "content": u.content,
                "timestamp": u.timestamp,
                "status": u.status.value if hasattr(u.status, 'value') else u.status,
            }
            for u in updates
        ]
```

2. **Update the frontend API route** (`routes/api.thread-updates.ts`):

```typescript
const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
const response = await fetch(`${backendUrl}/api/thread-updates`)
const data = await response.json()
return Response.json(data)
```

3. **Set environment variable**:

```bash
export BACKEND_URL=http://localhost:8000
```

## Customization

### Adding More Filters

Edit `components/webhook-table.tsx` to add more filter options:

```typescript
const [customFilter, setCustomFilter] = useState("")

// Add to filteredUpdates logic
const matchesCustom = customFilter === "" || /* your logic */
```

### Changing Color Scheme

The app uses Tailwind CSS variables. Edit `app/app.css` to customize colors:

```css
:root {
  --primary: /* your color */;
  --secondary: /* your color */;
}
```

### Adding New Status Types

Update the `statusVariants` mapping in `components/webhook-table.tsx`:

```typescript
const statusVariants: Record<string, BadgeVariant> = {
  SUCCESS: "success",
  ERROR: "error",
  // Add your new status
  CUSTOM: "warning",
}
```

## Deployment

### Docker

```bash
docker build -t basehook-frontend .
docker run -p 3000:3000 -e BACKEND_URL=http://api:8000 basehook-frontend
```

### Environment Variables

- `BACKEND_URL`: URL of the Python FastAPI backend (default: `http://localhost:8000`)
- `NODE_ENV`: Set to `production` for production builds

## Troubleshooting

### Data not loading

1. Check browser console for errors
2. Verify the backend API is running and accessible
3. Check CORS settings on the backend
4. Verify the API endpoint returns correct JSON format

### Styles not applying

1. Run `npm run build` to rebuild CSS
2. Clear browser cache
3. Check that Tailwind classes are not purged

## License

MIT
