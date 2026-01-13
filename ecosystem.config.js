// PM2 ecosystem dosyası - Yol Asistan Backend için
// Bu dosya PM2 ile uygulamayı yönetmek için kullanılır
module.exports = {
  apps: [
    {
      name: 'yol-asist-api',
      script: './dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Log dosyaları
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Otomatik restart ayarları
      watch: false,
      max_memory_restart: '1G',
      // Crash durumunda otomatik restart
      autorestart: true,
      // Restart gecikmesi (ms)
      min_uptime: '10s',
      max_restarts: 10,
      // Graceful shutdown için bekleme süresi
      kill_timeout: 5000,
      // Uptime monitoring
      listen_timeout: 10000,
    },
  ],
};
