import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import { ffmpegManager } from './ffmpegAgent.js';
import { env } from './env.js';

const app = express();
app.use(express.json());

if (env.CORS_ORIGINS.includes('*')) {
  app.use(cors());
} else {
  app.use(cors({
    origin: env.CORS_ORIGINS,
  }));
}

// --- REST ---
app.get('/jobs', (req, res) => {
  res.json(ffmpegManager.listJobs());
});

app.get('/jobs/:id', (req, res) => {
  const job = ffmpegManager.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'not_found' });
  res.json(job);
});

app.post('/jobs', (req, res) => {
  const { input, output, method, extraArgs, userAgent, origin, presetName } = req.body ?? {};
  if (!input || !output || !method) return res.status(400).json({ error: 'missing_fields' });

  // simple allow list
  const allowed = env.ALLOWED_INPUT_PATTERNS.some((re: RegExp) => re.test(input));
  if (!allowed) return res.status(400).json({ error: 'input_not_allowed' });

  const job = ffmpegManager.createJob({ input, output, method, extraArgs, userAgent, origin, presetName });
  res.status(201).json(job);
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
  res.json({ ok: true });
});

// --- SOCKET.IO ---
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: env.CORS_ORIGINS.includes('*')
    ? { origin: true, methods: ['GET','POST'] }
    : { origin: env.CORS_ORIGINS, methods: ['GET','POST'] }
});

io.on('connection', socket => {
  socket.emit('jobs_snapshot', ffmpegManager.listJobs());

  const handler = (job: any) => socket.emit('job_update', job);
  ffmpegManager.on('update', handler);

  socket.on('disconnect', () => {
    ffmpegManager.off('update', handler);
  });
});

server.listen(env.PORT, () => {
  console.log(`FFmpeg agent API + WS listening on :${env.PORT}`);
});