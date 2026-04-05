# StudyStreak

A gamified study tracker with streaks, study hours, revision reminders, and task management.

## Structure

- `frontend/` - React + Vite + Tailwind UI
- `backend/` - Express API with MongoDB

## Run locally

1. Install dependencies:
   ```bash
   npm run install-all
   ```

2. Start the backend and frontend together:
   ```bash
   npm run dev
   ```

3. Open the app at `http://localhost:5173`

## Notes

- Backend connects to MongoDB at `mongodb://127.0.0.1:27017/studystreak` by default.
- Set `MONGODB_URI` to change the connection string.
