import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
dotenv.config();

import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import ticketRoutes from './routes/tickets';
import sprintRoutes from './routes/sprints';
import repoRoutes from './routes/repos';
import aiRoutes from './routes/ai';
import reportRoutes from './routes/reports';
import importRoutes from './routes/imports';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/tickets', ticketRoutes);
app.use('/api/projects/:projectId/sprints', sprintRoutes);
app.use('/api/projects/:projectId/repos', repoRoutes);
app.use('/api/repos', repoRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/projects/:projectId/reports', reportRoutes);
app.use('/api/projects/:projectId/import', importRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use(errorHandler);

app.listen(PORT, () => console.log(`Tracking System API running on http://localhost:${PORT}`));

export default app;
