# TrackingSystem — Jira-like User Story & Defect Tracker

## Setup

### 1. PostgreSQL Database
Create a database named `trackingsystem`:
```sql
CREATE DATABASE trackingsystem;
```

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL (with your postgres password), ANTHROPIC_API_KEY
npm install
npm run db:generate   # generate migrations
npm run db:migrate    # apply migrations to DB
npm run dev           # start backend on http://localhost:3001
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev           # start frontend on http://localhost:5173
```

---

## Environment Variables (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs (change in production) |
| `ANTHROPIC_API_KEY` | Your Claude API key (for AI features) |
| `PORT` | Backend port (default 3001) |

---

## Features

| Feature | Description |
|---|---|
| **Projects** | Multi-project workspace with unique ticket key prefixes |
| **User Stories** | `PROJ-US-N` keys, acceptance criteria, story points |
| **Defects** | `PROJ-DEF-N` keys, steps to reproduce, expected/actual |
| **Tasks** | `PROJ-TASK-N` keys |
| **Sprint Board** | Kanban drag-and-drop board per sprint |
| **Backlog** | Filter by type/status, inline edit |
| **Git Integration** | Local repos (simple-git) + GitHub (Octokit) |
| **Commit Linking** | Reference tickets in commits: `[PROJ-US-1]` |
| **Branch Management** | Create branches from within the system |
| **AI Ticket Gen** | Claude generates full tickets from brief descriptions |
| **AI Doc Gen** | Architecture diagram, sequence diagrams, dev guide |
| **Gap Analysis** | AI-powered branch comparison and merge readiness report |
| **Excel Import** | Bulk upload stories and defects via Excel |
| **Reports** | Linked/unlinked tickets, sprint velocity chart |

---

## Commit Convention for Ticket Linking

Reference tickets in commit messages using square brackets:
```
git commit -m "Implement login form [MYAPP-US-3] [MYAPP-DEF-1]"
```

Tickets `MYAPP-US-3` and `MYAPP-DEF-1` will automatically appear on those ticket detail pages under "Commits".
