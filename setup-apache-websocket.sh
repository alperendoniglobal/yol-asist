#!/bin/bash
# Apache WebSocket modüllerini aktif etme scripti
# Bu scripti root olarak çalıştırın: sudo bash setup-apache-websocket.sh

echo "Apache WebSocket modüllerini aktif ediliyor..."

# Gerekli modülleri aktif et
a2enmod proxy
a2enmod proxy_http
a2enmod proxy_wstunnel
a2enmod rewrite
a2enmod headers

# Apache yapılandırmasını test et
echo "Apache yapılandırması test ediliyor..."
apache2ctl configtest

if [ $? -eq 0 ]; then
    echo "✅ Yapılandırma başarılı! Apache yeniden başlatılıyor..."
    systemctl restart apache2
    echo "✅ Apache yeniden başlatıldı!"
else
    echo "❌ Yapılandırma hatası var! Lütfen hataları düzeltin."
    exit 1
fi

echo ""
echo "Aktif modüller:"
apache2ctl -M | grep -E "(proxy|ws|rewrite|headers)"

echo ""
echo "✅ Kurulum tamamlandı!"
echo "Şimdi /etc/apache2/sites-available/cozum.net.conf dosyanızı düzenleyin"
echo "ve apache-websocket-config.conf dosyasındaki yapılandırmayı ekleyin."
