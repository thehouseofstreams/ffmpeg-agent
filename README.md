# 🧪 FFmpeg Agent (Node.js + PM2)

Un agente en Node.js que permite iniciar, pausar, reiniciar y eliminar procesos de FFmpeg vía API REST y WebSocket. Soporta múltiples calidades (`low`, `medium`, `high`, `custom`), headers personalizados (`user-agent`, `referer`) y test automático vía shell.

---

## 🚀 Requisitos

- Node.js 20+
- FFmpeg instalado (`ffmpeg -version`)
- Git (para clonar el repositorio)
- `pm2` 
- `jq` (para test script)

### Comandos:
```bash
apt update
apt install curl -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install nodejs -y
apt install ffmpeg -y
apt install git -y
npm install -g pm2
apt install jq -y
```

---

## 📦 Instalación con PM2 (recomendado para VPS)

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/ffmpeg-agent.git
cd ffmpeg-agent

# 2. Instalar dependencias
npm install

# 3. Compilar TypeScript
npm run build
```

## ▶️ Ejecutar con PM2
```bash
# Instalar pm2 si no lo tenés
npm install -g pm2

# Ejecutar agente
FFMPEG_PATH=/usr/bin/ffmpeg pm2 start dist/server.js --name ffmpeg-agent

# Guardar proceso para reinicio automático
pm2 save
pm2 startup
```

## 🧪 Probar la API

```bash
# Verificar que esté corriendo
curl http://localhost:8080/jobs
```

## 🔁 Probar todos los modos automáticamente

```bash
# Instalar jq si no lo tenés
apt install jq -y

# Dar permisos y ejecutar el script
chmod +x scripts/test-ffmpeg-jobs.sh
./scripts/test-ffmpeg-jobs.sh
```

Este script prueba:
* Modo copy
* Presets low, medium, high
* Modo custom con customOptions
* Headers (userAgent, referer)


## 📡 Endpoints API

| Método | Ruta                | Descripción           |
| ------ | ------------------- | --------------------- |
| GET    | `/jobs`             | Listar todos los jobs |
| GET    | `/jobs/:id`         | Ver detalle de un job |
| POST   | `/jobs`             | Crear un nuevo job    |
| POST   | `/jobs/:id/pause`   | Pausar job            |
| POST   | `/jobs/:id/resume`  | Reanudar job          |
| POST   | `/jobs/:id/restart` | Reiniciar job         |
| DELETE | `/jobs/:id`         | Eliminar job          |

## ✍️ Configuración de presets

Los presets están definidos en `ffmpegAgent.ts`:

## ✍️ Configuración de presets

| Preset   | Resolución | Bitrate de video | FPS  | CRF | Bufsize | Maxrate | Audio Bitrate | Observaciones                  |
|----------|------------|------------------|------|-----|---------|---------|----------------|-------------------------------|
| `low`    | 480p       | 800k             | 25   | 28  | 1600k   | 800k    | 96k            | Escala y codifica             |
| `medium` | 720p       | 1500k            | 30   | 23  | 3000k   | 2000k   | 128k           | Para calidad media            |
| `high`   | 1080p      | 3000k            | 30   | 20  | 5000k   | 4000k   | 192k           | Para calidad alta             |
| `custom` | configurable | configurable   | sí   | sí  | sí      | sí      | sí             | Definido por `customOptions`  |


- **`custom`**  | Configurable vía el objeto `customOptions`, por ejemplo:

  ```json
  {
    "crf": 22,
    "fps": 30,
    "width": 640,
    "videoBitrate": "1200k",
    "audioBitrate": "128k",
    "maxrate": "1500k",
    "bufsize": "2000k"
  }
   ```

## 🔐 Variables de entorno

| Variable      | Descripción                          | Ejemplo              |
| ------------- | ------------------------------------ | -------------------- |
| `FFMPEG_PATH` | Ruta absoluta al binario de `ffmpeg` | `/usr/bin/ffmpeg`    |
| `PORT`        | Puerto donde corre el servidor HTTP  | `8080` (por defecto) |
