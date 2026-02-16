# Apache WebSocket Yapılandırma Kılavuzu

## Sorun
Socket.IO sunucusu `wss://cozum.net/socket.io/` adresinde çalışmıyor. Local'de çalışan socket sunucu production'da çalışmıyor.

## Çözüm
Apache'de WebSocket desteği için proxy yapılandırması yapılması gerekiyor.

## Adım 1: Gerekli Apache Modüllerini Aktif Et

```bash
# Proxy modüllerini aktif et
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite
sudo a2enmod headers

# Apache'yi yeniden başlat
sudo systemctl restart apache2
```

## Adım 2: Apache VirtualHost Yapılandırması

`/etc/apache2/sites-available/cozum.net.conf` dosyanızı düzenleyin veya yeni oluşturun.

### Örnek Yapılandırma (HTTPS - Önerilen)

```apache
<VirtualHost *:443>
    ServerName cozum.net
    ServerAlias www.cozum.net
    
    # SSL yapılandırması
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/cozum.net/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/cozum.net/privkey.pem
    
    # Proxy ayarları
    ProxyPreserveHost On
    
    # Socket.IO için WebSocket proxy (ÖNEMLİ: Bu kısım mutlaka olmalı)
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /socket.io/(.*) ws://localhost:3000/socket.io/$1 [P,L]
    
    # Socket.IO için HTTP proxy (polling fallback)
    RewriteCond %{HTTP:Upgrade} !=websocket [NC]
    RewriteRule /socket.io/(.*) http://localhost:3000/socket.io/$1 [P,L]
    
    # API istekleri için proxy
    ProxyPass /api http://localhost:3000/api
    ProxyPassReverse /api http://localhost:3000/api
    
    # Log dosyaları
    ErrorLog ${APACHE_LOG_DIR}/cozum.net-error.log
    CustomLog ${APACHE_LOG_DIR}/cozum.net-access.log combined
</VirtualHost>
```

### Örnek Yapılandırma (HTTP - Sadece test için)

```apache
<VirtualHost *:80>
    ServerName cozum.net
    ServerAlias www.cozum.net
    
    ProxyPreserveHost On
    
    # Socket.IO için WebSocket proxy
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /socket.io/(.*) ws://localhost:3000/socket.io/$1 [P,L]
    
    # Socket.IO için HTTP proxy
    RewriteCond %{HTTP:Upgrade} !=websocket [NC]
    RewriteRule /socket.io/(.*) http://localhost:3000/socket.io/$1 [P,L]
    
    # API istekleri için proxy
    ProxyPass /api http://localhost:3000/api
    ProxyPassReverse /api http://localhost:3000/api
    
    ErrorLog ${APACHE_LOG_DIR}/cozum.net-error.log
    CustomLog ${APACHE_LOG_DIR}/cozum.net-access.log combined
</VirtualHost>
```

## Adım 3: Site'ı Aktif Et ve Apache'yi Yeniden Başlat

```bash
# Site'ı aktif et
sudo a2ensite cozum.net.conf

# Apache yapılandırmasını test et
sudo apache2ctl configtest

# Hata yoksa Apache'yi yeniden başlat
sudo systemctl restart apache2
```

## Adım 4: Port Kontrolü

Node.js sunucunuzun 3000 portunda çalıştığından emin olun:

```bash
# PM2 ile çalışıyorsa
pm2 list

# Port kontrolü
netstat -tulpn | grep 3000
# veya
ss -tulpn | grep 3000
```

## Adım 5: Test

1. **Browser Console'da test:**
```javascript
// Frontend'de Socket.IO bağlantısını test et
const socket = io('https://cozum.net', {
  transports: ['websocket', 'polling'],
  path: '/socket.io/'
});

socket.on('connect', () => {
  console.log('Socket bağlantısı başarılı!');
});

socket.on('error', (error) => {
  console.error('Socket hatası:', error);
});
```

2. **Apache log'larını kontrol et:**
```bash
# Hata log'larını izle
sudo tail -f /var/log/apache2/cozum.net-error.log

# Access log'larını izle
sudo tail -f /var/log/apache2/cozum.net-access.log
```

## Sorun Giderme

### WebSocket bağlantısı kurulamıyor
- `mod_proxy_wstunnel` modülünün aktif olduğundan emin olun
- Apache yapılandırmasında `RewriteEngine On` olduğundan emin olun
- Node.js sunucusunun çalıştığından emin olun

### 502 Bad Gateway hatası
- Node.js sunucusunun 3000 portunda çalıştığını kontrol edin
- Firewall'ın 3000 portunu engellemediğinden emin olun

### Connection refused hatası
- `localhost:3000` yerine `127.0.0.1:3000` deneyin
- Node.js sunucusunun tüm interface'lerde dinlediğinden emin olun (0.0.0.0)

### SSL/HTTPS sorunları
- SSL sertifikasının geçerli olduğundan emin olun
- Let's Encrypt kullanıyorsanız: `sudo certbot renew`

## Önemli Notlar

1. **Port numarası:** Node.js sunucunuz farklı bir portta çalışıyorsa (örn: 3001), yapılandırmadaki `3000` değerlerini değiştirin.

2. **Path:** Socket.IO path'i `/socket.io/` olarak ayarlanmış. Eğer farklı bir path kullanıyorsanız, yapılandırmayı buna göre güncelleyin.

3. **CORS:** Socket.IO sunucu yapılandırmasında CORS ayarlarının doğru olduğundan emin olun (`socketServer.ts` dosyasında).

4. **Production:** Production ortamında mutlaka HTTPS kullanın. WebSocket güvenliği için WSS (WebSocket Secure) gereklidir.
