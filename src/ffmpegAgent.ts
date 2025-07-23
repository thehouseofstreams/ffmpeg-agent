import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { FfmpegJob, FfmpegJobConfig } from './types.js';

export class FfmpegManager extends EventEmitter {
  private jobs = new Map<string, { job: FfmpegJob; proc?: ChildProcess }>();

  createJob(cfg: FfmpegJobConfig): FfmpegJob {
    const id = randomUUID();
    const job: FfmpegJob = { id, ...cfg, state: 'starting' } as any;
    this.jobs.set(id, { job });
    this.emit('update', { ...job });
    setImmediate(() => this.startJob(id));
    return job;
  }

  private buildArgs(job: FfmpegJobConfig): string[] {
    const copyMode = job.method === 'copy';

    const headers = copyMode
      ? [
          '-headers',
          "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nReferer: https://alkass.net\r\n",
        ]
      : [];

    const inputArgs = [
      ...headers,
      '-i', job.input,
    ];

    const processingArgs = copyMode
      ? ['-c', 'copy', '-f', 'flv']
      : (job.extraArgs ?? 
        [
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '28',
          '-vf', 'scale=-2:480,fps=25',
          '-b:v', '800k',
          '-maxrate', '800k',
          '-bufsize', '1600k',
          '-c:a', 'aac',
          '-b:a', '96k'
        ]);
    return [
      '-y',
      ...inputArgs,
      ...processingArgs,
      job.output,
    ];
  }

  startJob(id: string) {
    const rec = this.jobs.get(id);
    if (!rec) return;
    const { job } = rec;
    const args = this.buildArgs(job);
    const cmd = [process.env.FFMPEG_PATH ?? 'ffmpeg', ...args].join(' ');
    console.log('Ejecutando:', cmd);
    const proc = spawn(process.env.FFMPEG_PATH ?? 'ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    job.pid = proc.pid ?? undefined;
    job.startedAt = Date.now();
    job.state = 'running';
    rec.proc = proc;
    this.emit('update', { ...job });

    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', chunk => {
      job.lastLog = chunk;
      parseFfmpegProgress(chunk, job);
      this.emit('update', { ...job });
    });

    proc.on('exit', (code, sig) => {
      job.endedAt = Date.now();
      job.state = code === 0 ? 'stopped' : 'error';
      job.errorMsg = code === 0 ? undefined : `Exited code ${code} sig ${sig}`;
      this.emit('update', { ...job });
    });
  }

  killJob(id: string) {
    const rec = this.jobs.get(id);
    if (rec?.proc) {
      rec.proc.kill('SIGTERM');
      rec.job.state = 'killed';
      this.emit('update', { ...rec.job });
    }
    this.jobs.delete(id);
  }

  pauseJob(id: string) {
    const rec = this.jobs.get(id);
    if (rec?.proc?.pid) {
      process.kill(rec.proc.pid, 'SIGSTOP');
      rec.job.state = 'paused';
      this.emit('update', { ...rec.job });
    }
  }

  resumeJob(id: string) {
    const rec = this.jobs.get(id);
    if (rec?.proc?.pid) {
      process.kill(rec.proc.pid, 'SIGCONT');
      rec.job.state = 'running';
      this.emit('update', { ...rec.job });
    }
  }

  restartJob(id: string) {
    const rec = this.jobs.get(id);
    if (!rec) return;
    if (rec.proc) {
      rec.proc.kill('SIGTERM');
      rec.proc = undefined;
    }
    rec.job.state = 'starting';
    rec.job.startedAt = undefined;
    rec.job.endedAt = undefined;
    rec.job.pid = undefined;
    rec.job.lastLog = undefined;
    rec.job.errorMsg = undefined;
    this.emit('update', { ...rec.job });
    // kill is async; small delay to avoid race
    setTimeout(() => this.startJob(id), 250);
  }

  listJobs(): FfmpegJob[] {
    return [...this.jobs.values()].map(({ job }) => ({ ...job, uptimeSec: calcUptime(job) }));
  }

  getJob(id: string): FfmpegJob | undefined {
    const rec = this.jobs.get(id);
    if (!rec) return;
    return { ...rec.job, uptimeSec: calcUptime(rec.job) };
  }
}

function calcUptime(job: FfmpegJob): number | undefined {
  if (!job.startedAt) return undefined;
  const end = job.endedAt ?? Date.now();
  return Math.floor((end - job.startedAt) / 1000);
}

function parseFfmpegProgress(line: string, job: FfmpegJob) {
  const sizeMatch = /size=\s*([\d\.]+)(\w*)/i.exec(line);
  const brMatch = /bitrate=\s*([\d\.]+)kbits\/s/i.exec(line);
  const spMatch = /speed=\s*([\d\.]+)x/i.exec(line);
  const frmMatch = /frame=\s*(\d+)/i.exec(line);
  if (sizeMatch) job.sizeBytes = approxBytes(sizeMatch[1], sizeMatch[2]);
  if (brMatch) job.bitrateKbps = Number(brMatch[1]);
  if (spMatch) job.speed = Number(spMatch[1]);
  if (frmMatch) job.lastFrame = Number(frmMatch[1]);
}

function approxBytes(val: string, unit: string): number {
  const n = Number(val);
  const u = unit.toLowerCase();
  if (u.startsWith('kb')) return Math.round(n * 1024);
  if (u.startsWith('mb')) return Math.round(n * 1024 * 1024);
  if (u.startsWith('gb')) return Math.round(n * 1024 * 1024 * 1024);
  return Math.round(n);
}

export const ffmpegManager = new FfmpegManager();
