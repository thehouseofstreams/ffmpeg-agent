import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { ffmpegManager } from './ffmpegAgent';
import type { FfmpegJobConfig } from './types';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
  },
});

app.use(cors());
app.use(express.json());

// Emitir estado inicial a todos los clientes nuevos
io.on('connection', (socket) => {
  socket.emit('jobs', ffmpegManager.listJobs());
});

// Reemitir cambios a todos los clientes conectados
ffmpegManager.on('update', () => {
  io.emit('jobs', ffmpegManager.listJobs());
});

// API Routes
app.get('/jobs', (_req, res) => {
  res.json(ffmpegManager.listJobs());
});

app.get('/jobs/:id', (req, res) => {
  const job = ffmpegManager.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  res.json(job);
});

app.post('/jobs', (req, res) => {
  try {
    const job = ffmpegManager.createJob(req.body as FfmpegJobConfig);
    res.status(201).json(job);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/jobs/:id/pause', (req, res) => {
  ffmpegManager.pauseJob(req.params.id);
  res.json({ ok: true });
});

app.post('/jobs/:id/resume', (req, res) => {
  ffmpegManager.resumeJob(req.params.id);
  res.json({ ok: true });
});

app.post('/jobs/:id/restart', (req, res) => {
  ffmpegManager.restartJob(req.params.id);
  res.json({ ok: true });
});

app.delete('/jobs/:id', (req, res) => {
  ffmpegManager.killJob(req.params.id);
  res.status(204).end();
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});