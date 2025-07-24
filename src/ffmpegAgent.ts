import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { FfmpegJob, FfmpegJobConfig } from './types.js';

export class FfmpegManager extends EventEmitter {
  private jobs = new Map<string, { job: FfmpegJob; proc?: ChildProcess }>();

  constructor() {
    super();
    
    // Mostrar estado de logging al inicializar
    const loggingStatus = process.env.DISABLE_FFMPEG_LOGS === 'true' ? 'DISABLED' : 'ENABLED';
    console.log(`📝 FFmpeg logging: ${loggingStatus}`);
    
    // Limpiar logs existentes si está deshabilitado
    this.cleanupExistingLogs();
  }

  createJob(cfg: FfmpegJobConfig): FfmpegJob {
    const id = randomUUID();
    const job: FfmpegJob = {
      id,
      ...cfg,
      state: 'starting',
      startedAt: undefined,
      endedAt: undefined,
      pid: undefined,
      uptimeSec: undefined,
      sizeBytes: undefined,
      bitrateKbps: undefined,
      speed: undefined,
      lastFrame: undefined,
      lastLog: undefined,
      errorMsg: undefined,
    } as FfmpegJob;
    
    this.jobs.set(id, { job });
    console.log(`🆕 Job created: ${id}`);
    this.emitUpdate(job);
    
    // Iniciar el job de forma asíncrona
    setImmediate(() => this.startJob(id));
    return job;
  }

  private emitUpdate(job: FfmpegJob) {
    // Calcular uptime antes de emitir
    const jobWithUptime = {
      ...job,
      uptimeSec: calcUptime(job)
    };
    
    console.log(`📡 Emitting update for job ${job.id}: ${job.state}`);
    this.emit('update', jobWithUptime);
  }

  private buildArgs(job: FfmpegJobConfig): string[] {
    const copyMode = job.method === 'copy';

    // Headers opcionales - formato mejorado
    const headers: string[] = [];
    if (job.headers?.userAgent || job.headers?.referer) {
      const headerLines: string[] = [];
      if (job.headers?.userAgent)
        headerLines.push(`User-Agent: ${job.headers.userAgent}`);
      if (job.headers?.referer)
        headerLines.push(`Referer: ${job.headers.referer}`);
      if (job.headers?.origin)
        headerLines.push(`Origin: ${job.headers.origin}`);
      if (job.headers?.cookie)
        headerLines.push(`Cookie: ${job.headers.cookie}`);
      if (job.headers?.authorization)
        headerLines.push(`Authorization: ${job.headers.authorization}`);
      
      const headerString = headerLines.join('\\r\\n') + '\\r\\n';
      headers.push('-headers', headerString);
      console.log('🔑 Headers configured:', headerLines.length, 'headers');
    }

    const inputArgs = [
      ...headers, 
      '-i', job.input,
      '-reconnect', '1',
      '-reconnect_streamed', '1', 
      '-reconnect_delay_max', '5'
    ];

    if (copyMode) {
      return [
        '-y', 
        ...inputArgs, 
        '-c', 'copy', 
        '-f', 'flv',
        '-flvflags', 'no_duration_filesize',
        job.output
      ];
    }

    // Presets de encoding mejorados
    let processingArgs: string[];
    switch (job.preset) {
      case 'low':
        processingArgs = [
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '28',
          '-vf', 'scale=-2:480,fps=25',
          '-b:v', '800k',
          '-maxrate', '800k',
          '-bufsize', '1600k',
          '-c:a', 'aac',
          '-b:a', '96k',
          '-f', 'flv'
        ];
        break;
      case 'medium':
        processingArgs = [
          '-c:v', 'libx264',
          '-preset', 'faster',
          '-crf', '23',
          '-vf', 'scale=-2:720,fps=30',
          '-b:v', '1500k',
          '-maxrate', '2000k',
          '-bufsize', '3000k',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-f', 'flv'
        ];
        break;
      case 'high':
        processingArgs = [
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '20',
          '-vf', 'scale=-2:1080,fps=30',
          '-b:v', '3000k',
          '-maxrate', '4000k',
          '-bufsize', '5000k',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-f', 'flv'
        ];
        break;
      case 'custom': {
        const o = job.customOptions ?? {};
        processingArgs = [
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          ...(o.crf !== undefined ? ['-crf', String(o.crf)] : []),
          ...(o.fps !== undefined || o.width !== undefined
            ? ['-vf', `scale=${o.width ? `${o.width}:-2` : '-2:-2'}${o.fps ? `,fps=${o.fps}` : ''}`]
            : []),
          ...(o.videoBitrate ? ['-b:v', o.videoBitrate] : []),
          ...(o.maxrate ? ['-maxrate', o.maxrate] : []),
          ...(o.bufsize ? ['-bufsize', o.bufsize] : []),
          '-c:a', 'aac',
          ...(o.audioBitrate ? ['-b:a', o.audioBitrate] : ['-b:a', '96k']),
          '-f', 'flv'
        ];
        break;
      }
      default:
        throw new Error(`Unknown preset: ${job.preset}`);
    }

    return ['-y', ...inputArgs, ...processingArgs, job.output];
  }

  startJob(id: string) {
    const rec = this.jobs.get(id);
    if (!rec) {
      console.error(`❌ Job not found: ${id}`);
      return;
    }
    
    const { job } = rec;
    
    try {
      const args = this.buildArgs(job);
      const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';
      
      console.log(`🚀 Starting job ${id}:`, job.input, '->', job.output);
      console.log(`🛠️ Command: ${ffmpegPath} ${args.join(' ')}`);
      
      // ✅ Configuración de entorno condicional basada en variable
      const shouldEnableLogs = process.env.DISABLE_FFMPEG_LOGS !== 'true';
      const envConfig = {
        ...process.env,
        ...(shouldEnableLogs && {
          FFREPORT: 'file=ffmpeg-%t.log:level=16'
        })
      };
      
      // Mostrar estado de logging
      if (shouldEnableLogs) {
        console.log(`📝 FFmpeg logging enabled for job ${id}`);
      } else {
        console.log(`🚫 FFmpeg logging disabled for job ${id} (DISABLE_FFMPEG_LOGS=true)`);
      }
      
      const proc = spawn(ffmpegPath, args, { 
        stdio: ['ignore', 'pipe', 'pipe'],
        env: envConfig
      });

      job.pid = proc.pid ?? undefined;
      job.startedAt = Date.now();
      job.state = 'running';
      job.errorMsg = undefined;
      rec.proc = proc;
      
      this.emitUpdate(job);

      // Manejar stderr (progress y errores)
      if (proc.stderr) {
        proc.stderr.setEncoding('utf8');
        let stderrBuffer = '';
        
        proc.stderr.on('data', (chunk: string) => {
          stderrBuffer += chunk;
          job.lastLog = chunk.trim();
          
          // Parsear progreso de FFmpeg
          this.parseFfmpegProgress(chunk, job);
          
          // Emitir actualización con throttling
          this.throttledEmitUpdate(job);
        });
      }

      // Manejar stdout (si hay)
      if (proc.stdout) {
        proc.stdout.setEncoding('utf8');
        proc.stdout.on('data', (chunk) => {
          // Solo mostrar stdout si logs están habilitados
          if (shouldEnableLogs) {
            console.log(`📤 FFmpeg stdout [${id}]:`, chunk.trim());
          }
        });
      }

      // Manejar exit
      proc.on('exit', (code, signal) => {
        console.log(`🏁 Job ${id} exited with code ${code}, signal ${signal}`);
        
        job.endedAt = Date.now();
        job.pid = undefined;
        
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          job.state = 'killed';
          job.errorMsg = `Terminated by signal ${signal}`;
        } else if (code === 0) {
          job.state = 'stopped';
          job.errorMsg = undefined;
        } else {
          job.state = 'error';
          job.errorMsg = `Process exited with code ${code}`;
        }
        
        this.emitUpdate(job);
      });

      // Manejar errores del proceso
      proc.on('error', (error) => {
        console.error(`❌ Process error for job ${id}:`, error.message);
        job.state = 'error';
        job.errorMsg = `Process error: ${error.message}`;
        job.endedAt = Date.now();
        this.emitUpdate(job);
      });

    } catch (error: any) {
      console.error(`❌ Failed to start job ${id}:`, error.message);
      job.state = 'error';
      job.errorMsg = `Failed to start: ${error.message}`;
      job.endedAt = Date.now();
      this.emitUpdate(job);
    }
  }

  // Throttling para evitar spam de updates
  private updateTimeouts = new Map<string, NodeJS.Timeout>();
  
  private throttledEmitUpdate(job: FfmpegJob) {
    const existingTimeout = this.updateTimeouts.get(job.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    const timeout = setTimeout(() => {
      this.emitUpdate(job);
      this.updateTimeouts.delete(job.id);
    }, 1000); // Emitir máximo cada segundo
    
    this.updateTimeouts.set(job.id, timeout);
  }

  killJob(id: string) {
    const rec = this.jobs.get(id);
    if (!rec) {
      console.warn(`⚠️ Trying to kill non-existent job: ${id}`);
      return;
    }

    console.log(`🗑️ Killing job ${id}`);
    
    if (rec.proc && rec.proc.pid) {
      try {
        // Intentar terminación graceful primero
        rec.proc.kill('SIGTERM');
        
        // Si no termina en 5 segundos, forzar
        setTimeout(() => {
          if (rec.proc && rec.proc.pid) {
            console.log(`💥 Force killing job ${id}`);
            rec.proc.kill('SIGKILL');
          }
        }, 5000);
        
      } catch (error) {
        console.error(`❌ Error killing process for job ${id}:`, error);
      }
    }
    
    rec.job.state = 'killed';
    rec.job.endedAt = Date.now();
    this.emitUpdate(rec.job);
    
    // Limpiar el job después de un delay
    setTimeout(() => {
      this.jobs.delete(id);
      console.log(`🧹 Job ${id} cleaned up`);
    }, 2000);
  }

  pauseJob(id: string) {
    const rec = this.jobs.get(id);
    if (!rec?.proc?.pid) {
      console.warn(`⚠️ Cannot pause job ${id}: no process`);
      return;
    }

    try {
      process.kill(rec.proc.pid, 'SIGSTOP');
      rec.job.state = 'paused';
      console.log(`⏸️ Job ${id} paused`);
      this.emitUpdate(rec.job);
    } catch (error) {
      console.error(`❌ Error pausing job ${id}:`, error);
    }
  }

  resumeJob(id: string) {
    const rec = this.jobs.get(id);
    if (!rec?.proc?.pid) {
      console.warn(`⚠️ Cannot resume job ${id}: no process`);
      return;
    }

    try {
      process.kill(rec.proc.pid, 'SIGCONT');
      rec.job.state = 'running';
      console.log(`▶️ Job ${id} resumed`);
      this.emitUpdate(rec.job);
    } catch (error) {
      console.error(`❌ Error resuming job ${id}:`, error);
    }
  }

  restartJob(id: string) {
    const rec = this.jobs.get(id);
    if (!rec) {
      console.warn(`⚠️ Cannot restart non-existent job: ${id}`);
      return;
    }

    console.log(`🔄 Restarting job ${id}`);
    
    // Matar proceso actual si existe
    if (rec.proc && rec.proc.pid) {
      try {
        rec.proc.kill('SIGTERM');
      } catch (error) {
        console.error(`❌ Error killing process during restart:`, error);
      }
      rec.proc = undefined;
    }
    
    // Resetear estado del job
    rec.job.state = 'starting';
    rec.job.startedAt = undefined;
    rec.job.endedAt = undefined;
    rec.job.pid = undefined;
    rec.job.lastLog = undefined;
    rec.job.errorMsg = undefined;
    rec.job.sizeBytes = undefined;
    rec.job.bitrateKbps = undefined;
    rec.job.speed = undefined;
    rec.job.lastFrame = undefined;
    
    this.emitUpdate(rec.job);
    
    // Reiniciar después de un pequeño delay
    setTimeout(() => this.startJob(id), 1000);
  }

  listJobs(): FfmpegJob[] {
    return [...this.jobs.values()].map(({ job }) => ({
      ...job,
      uptimeSec: calcUptime(job)
    }));
  }

  getJob(id: string): FfmpegJob | undefined {
    const rec = this.jobs.get(id);
    if (!rec) return undefined;
    
    return {
      ...rec.job,
      uptimeSec: calcUptime(rec.job)
    };
  }

  private parseFfmpegProgress(line: string, job: FfmpegJob) {
    try {
      // Parsear diferentes métricas de FFmpeg
      const sizeMatch = /size=\s*([\d\.]+)(\w*)/i.exec(line);
      const brMatch = /bitrate=\s*([\d\.]+)kbits\/s/i.exec(line);
      const spMatch = /speed=\s*([\d\.]+)x/i.exec(line);
      const frmMatch = /frame=\s*(\d+)/i.exec(line);
      const timeMatch = /time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/i.exec(line);
      
      if (sizeMatch) {
        job.sizeBytes = this.approxBytes(sizeMatch[1], sizeMatch[2] || 'B');
      }
      if (brMatch) {
        job.bitrateKbps = Number(brMatch[1]);
      }
      if (spMatch) {
        job.speed = Number(spMatch[1]);
      }
      if (frmMatch) {
        job.lastFrame = Number(frmMatch[1]);
      }
      
      // Detectar errores comunes
      if (line.includes('Connection refused') || 
          line.includes('No such file') || 
          line.includes('Invalid data found')) {
        job.errorMsg = line.trim();
      }
      
    } catch (error) {
      // Ignorar errores de parsing silenciosamente
    }
  }

  private approxBytes(val: string, unit: string): number {
    const n = Number(val);
    const u = unit.toLowerCase();
    if (u.startsWith('kb')) return Math.round(n * 1024);
    if (u.startsWith('mb')) return Math.round(n * 1024 * 1024);
    if (u.startsWith('gb')) return Math.round(n * 1024 * 1024 * 1024);
    return Math.round(n);
  }

  // ✅ Método para limpiar logs existentes
  private cleanupExistingLogs() {
    if (process.env.DISABLE_FFMPEG_LOGS === 'true') {
      try {
        const fs = require('fs');
        
        // Leer directorio actual
        const files = fs.readdirSync('.');
        const logFiles = files.filter((file: string) => file.match(/^ffmpeg-.*\.log$/));
        
        if (logFiles.length > 0) {
          console.log(`🧹 Cleaning up ${logFiles.length} existing FFmpeg log files...`);
          
          logFiles.forEach((file: string) => {
            try {
              fs.unlinkSync(file);
              console.log(`🗑️ Deleted: ${file}`);
            } catch (error) {
              console.warn(`⚠️ Could not delete ${file}:`, error);
            }
          });
          
          console.log(`✅ Log cleanup completed`);
        } else {
          console.log(`📋 No existing FFmpeg log files found`);
        }
      } catch (error) {
        console.warn(`⚠️ Error during log cleanup:`, error);
      }
    }
  }
}

function calcUptime(job: FfmpegJob): number | undefined {
  if (!job.startedAt) return undefined;
  const end = job.endedAt ?? Date.now();
  return Math.floor((end - job.startedAt) / 1000);
}

export const ffmpegManager = new FfmpegManager();