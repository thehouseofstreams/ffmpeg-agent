export type FfmpegMethod = 'copy' | 'encode';
export type FfmpegState = 'starting' | 'running' | 'paused' | 'stopped' | 'error' | 'killed';

export interface FfmpegJobConfig {
  input: string;
  output: string;
  method: FfmpegMethod;
  extraArgs?: string[];
  userAgent?: string;
  origin?: string;
  presetName?: string;
}

export interface RuntimeStats {
  state: FfmpegState;
  pid?: number;
  startedAt?: number;
  endedAt?: number;
  uptimeSec?: number;
  sizeBytes?: number;
  bitrateKbps?: number;
  speed?: number;
  lastFrame?: number;
  lastLog?: string;
  errorMsg?: string;
}

export interface FfmpegJob extends FfmpegJobConfig, RuntimeStats {
  id: string;
}
