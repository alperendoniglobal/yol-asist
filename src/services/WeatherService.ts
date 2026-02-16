import axios from 'axios';
import logger from '../utils/logger';
import { TURKISH_CITY_COORDINATES, getCityKey } from '../data/turkishCityCoordinates';

/**
 * Open-Meteo hava durumu servisi (ücretsiz, API key yok).
 * Şehir adına göre bugünkü weather code alır. Önce 81 il sabit koordinat listesi kullanılır.
 */
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEZONE = 'Europe/Istanbul';

/** Open-Meteo weather code: 61, 63, 65 = yağmur; 80, 81, 82 = sağanak */
const RAINY_CODES = [61, 63, 65, 80, 81, 82];

export class WeatherService {
  /**
   * Şehir adına göre bugünkü günlük weather code döndürür.
   * Önce 81 il sabit koordinat listesine bakılır; yoksa Open-Meteo Geocoding kullanılır.
   * @param cityName İl adı (örn. "İstanbul", "Ankara", "Hatay")
   * @returns weather code (0-99) veya null (şehir bulunamazsa / hata)
   */
  async getWeatherCodeForCity(cityName: string): Promise<number | null> {
    if (!cityName || !String(cityName).trim()) return null;

    try {
      let lat: number;
      let lon: number;
      let source: string;

      // 1) Önce bizdeki 81 il listesinden koordinat al (sadece il adı yeterli, doğru eşleşme garanti)
      const cityKey = getCityKey(cityName);
      if (cityKey && TURKISH_CITY_COORDINATES[cityKey]) {
        const coords = TURKISH_CITY_COORDINATES[cityKey];
        lat = coords.lat;
        lon = coords.lon;
        source = '81il listesi';
      } else {
        // 2) Listede yoksa Open-Meteo Geocoding (sadece Türkiye)
        const geoRes = await axios.get(GEOCODING_URL, {
          params: {
            name: String(cityName).trim(),
            count: 5,
            language: 'tr',
            format: 'json',
            countryCode: 'TR',
          },
          timeout: 10000,
        });

        const results = geoRes.data?.results;
        if (!Array.isArray(results) || results.length === 0) return null;

        const first = results[0];
        lat = first.latitude;
        lon = first.longitude;
        if (lat == null || lon == null) return null;
        source = `Geocoding TR: ${first.name || cityName}`;
      }

      logger.info(`Hava durumu koordinat: "${cityName}" -> ${source}, lat=${lat}, lon=${lon}`);

      // 2) Forecast: bugünkü daily weather code
      const forecastRes = await axios.get(FORECAST_URL, {
        params: {
          latitude: lat,
          longitude: lon,
          daily: 'weathercode',
          timezone: TIMEZONE,
          forecast_days: 1,
        },
        timeout: 10000,
      });

      const daily = forecastRes.data?.daily;
      const codes = daily?.weathercode;
      if (!Array.isArray(codes) || codes.length === 0) return null;

      // API'den gelen ham response'u terminale bas
      logger.info(`Open-Meteo Forecast API response:\n${JSON.stringify(forecastRes.data, null, 2)}`);

      const code = Number(codes[0]);
      if (!isNaN(code)) {
        logger.info(`Hava durumu [Open-Meteo]: "${cityName}" -> lat=${lat}, lon=${lon}, weatherCode=${code} (tarih: ${daily?.time?.[0] ?? 'n/a'})`);
      }
      return isNaN(code) ? null : code;
    } catch (err: any) {
      logger.error(`WeatherService.getWeatherCodeForCity("${cityName}") hata:`, err?.message || err);
      return null;
    }
  }

  /**
   * Verilen weather code yağmur mu?
   * Open-Meteo: 61=rain slight, 63=rain moderate, 65=rain heavy, 80-82=rain showers
   */
  isRainyWeatherCode(code: number): boolean {
    return RAINY_CODES.includes(Number(code));
  }

  /**
   * Weather code'a göre kısa Türkçe hava durumu metni (SMS için).
   * WMO kodlarına göre gruplandırıldı.
   */
  getWeatherDescription(code: number): string {
    const c = Number(code);
    if (c === 0) return 'açık';
    if (c >= 1 && c <= 3) return 'parçalı bulutlu';
    if (c === 45 || c === 48) return 'sisli';
    if (c >= 51 && c <= 55) return 'çisentili';
    if (c >= 56 && c <= 67) return 'yağmurlu';
    if (c >= 71 && c <= 77) return 'karlı';
    if (c >= 80 && c <= 82) return 'sağanak yağmurlu';
    if (c >= 85 && c <= 86) return 'kar sağanağı';
    if (c >= 95 && c <= 99) return 'gök gürültülü sağanak';
    return 'bulutlu';
  }
}
