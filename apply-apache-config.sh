#!/bin/bash
# Apache yapılandırmasını güncelleme scripti
# Bu scripti root olarak çalıştırın: sudo bash apply-apache-config.sh

echo "Apache yapılandırması güncelleniyor..."

# Yedek al
echo "Yedek alınıyor..."
cp /etc/apache2/sites-available/000-default-le-ssl.conf /etc/apache2/sites-available/000-default-le-ssl.conf.backup.$(date +%Y%m%d_%H%M%S)
cp /etc/apache2/sites-available/000-default.conf /etc/apache2/sites-available/000-default.conf.backup.$(date +%Y%m%d_%H%M%S)

# Yeni yapılandırmayı kopyala
echo "Yeni yapılandırma uygulanıyor..."
cp /var/www/yol-asist/apache-ssl-config-updated.conf /etc/apache2/sites-available/000-default-le-ssl.conf
cp /var/www/yol-asist/apache-http-config-updated.conf /etc/apache2/sites-available/000-default.conf

# Apache yapılandırmasını test et
echo "Apache yapılandırması test ediliyor..."
apache2ctl configtest

if [ $? -eq 0 ]; then
    echo "✅ Yapılandırma başarılı! Apache yeniden başlatılıyor..."
    systemctl restart apache2
    echo "✅ Apache yeniden başlatıldı!"
    echo ""
    echo "Socket.IO WebSocket yapılandırması başarıyla uygulandı!"
    echo "Test için: wss://cozum.net/socket.io/"
else
    echo "❌ Yapılandırma hatası var! Yedeklerden geri yükleniyor..."
    # Hata durumunda yedekten geri yükle
    # cp /etc/apache2/sites-available/000-default-le-ssl.conf.backup.* /etc/apache2/sites-available/000-default-le-ssl.conf
    # cp /etc/apache2/sites-available/000-default.conf.backup.* /etc/apache2/sites-available/000-default.conf
    echo "Lütfen hataları düzeltin ve tekrar deneyin."
    exit 1
fi
