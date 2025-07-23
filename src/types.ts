export type FfmpegState = 'starting' | 'running' | 'paused' | 'stopped' | 'error' | 'killed';

export interface FfmpegJobConfig {
  input: string;
  output: string;
  method: 'copy' | 'encode';
  preset?: 'low' | 'medium' | 'high' | 'custom';

  headers?: {
    userAgent?: string;
    referer?: string;
    origin?: string;
    cookie?: string;
    authorization?: string;
    accept?: string;
    acceptLanguage?: string;
    acceptEncoding?: string;
  };

  customOptions?: {
    crf?: number;
    fps?: number;
    width?: number;
    videoBitrate?: string;
    audioBitrate?: string;
    maxrate?: string;
    bufsize?: string;
  };
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
