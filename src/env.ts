import 'dotenv/config';

export const env = {
  FFMPEG_PATH: process.env.FFMPEG_PATH ?? 'ffmpeg',
  PORT: Number(process.env.PORT ?? 8080),
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? '*').split(',').map(s => s.trim()).filter(Boolean),
  ALLOWED_INPUT_PATTERNS: (process.env.ALLOWED_INPUT_PATTERNS ?? '.*').split(',').map(s => new RegExp(s)),
};
