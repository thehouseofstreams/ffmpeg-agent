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

// ✅ Emitir snapshot inicial a nuevos clientes
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Emitir snapshot inicial inmediatamente
  const currentJobs = ffmpegManager.listJobs();
  socket.emit('jobs_snapshot', currentJobs);
  console.log(`📸 Sent initial snapshot to ${socket.id}:`, currentJobs.length, 'jobs');

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ✅ Reemitir actualizaciones individuales a todos los clientes
ffmpegManager.on('update', (updatedJob) => {
  console.log(`🔄 Job updated, broadcasting:`, updatedJob.id, updatedJob.state);
  io.emit('job_update', updatedJob);
});

// ✅ Enviar snapshot completo cuando sea necesario (opcional)
function broadcastSnapshot() {
  const allJobs = ffmpegManager.listJobs();
  console.log(`📸 Broadcasting snapshot:`, allJobs.length, 'jobs');
  io.emit('jobs_snapshot', allJobs);
}

// API Routes
app.get('/jobs', (_req, res) => {
  const jobs = ffmpegManager.listJobs();
  console.log(`📋 GET /jobs: returning ${jobs.length} jobs`);
  res.json(jobs);
});

app.get('/jobs/:id', (req, res) => {
  const job = ffmpegManager.getJob(req.params.id);
  if (!job) {
    console.log(`❌ Job not found: ${req.params.id}`);
    return res.status(404).json({ error: 'Job not found' });
  }
  console.log(`📋 GET /jobs/${req.params.id}:`, job.state);
  res.json(job);
});

app.post('/jobs', (req, res) => {
  try {
    console.log(`🚀 POST /jobs:`, req.body);
    const job = ffmpegManager.createJob(req.body as FfmpegJobConfig);
    console.log(`✅ Job created:`, job.id);
    res.status(201).json(job);
  } catch (err: any) {
    console.error(`❌ Job creation failed:`, err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post('/jobs/:id/pause', (req, res) => {
  console.log(`⏸️ POST /jobs/${req.params.id}/pause`);
  try {
    ffmpegManager.pauseJob(req.params.id);
    const updatedJob = ffmpegManager.getJob(req.params.id);
    res.json(updatedJob || { ok: true });
  } catch (err: any) {
    console.error(`❌ Pause failed:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/jobs/:id/resume', (req, res) => {
  console.log(`▶️ POST /jobs/${req.params.id}/resume`);
  try {
    ffmpegManager.resumeJob(req.params.id);
    const updatedJob = ffmpegManager.getJob(req.params.id);
    res.json(updatedJob || { ok: true });
  } catch (err: any) {
    console.error(`❌ Resume failed:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/jobs/:id/restart', (req, res) => {
  console.log(`🔄 POST /jobs/${req.params.id}/restart`);
  try {
    ffmpegManager.restartJob(req.params.id);
    const updatedJob = ffmpegManager.getJob(req.params.id);
    res.json(updatedJob || { ok: true });
  } catch (err: any) {
    console.error(`❌ Restart failed:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/jobs/:id', (req, res) => {
  console.log(`🗑️ DELETE /jobs/${req.params.id}`);
  try {
    const existingJob = ffmpegManager.getJob(req.params.id);
    if (!existingJob) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    ffmpegManager.killJob(req.params.id);
    console.log(`✅ Job deleted:`, req.params.id);
    res.status(204).end();
  } catch (err: any) {
    console.error(`❌ Delete failed:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Endpoint para debugging
app.get('/debug/jobs', (_req, res) => {
  const jobs = ffmpegManager.listJobs();
  res.json({
    totalJobs: jobs.length,
    jobs: jobs.map(j => ({
      id: j.id,
      state: j.state,
      input: j.input?.substring(0, 50) + '...',
      output: j.output?.substring(0, 50) + '...',
      uptimeSec: j.uptimeSec,
    }))
  });
});

// ✅ Endpoint para forzar snapshot (útil para debugging)
app.post('/debug/broadcast-snapshot', (_req, res) => {
  broadcastSnapshot();
  res.json({ ok: true, message: 'Snapshot broadcasted' });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
  
  // Snapshot inicial opcional (para debugging)
  setTimeout(() => {
    console.log(`📊 Server started with ${ffmpegManager.listJobs().length} existing jobs`);
  }, 1000);
});