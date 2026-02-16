import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Customer } from '../entities/Customer';
import { UserCustomer } from '../entities/UserCustomer';
import { WeatherService } from './WeatherService';
import { SmsService } from './SmsService';
import logger from '../utils/logger';

/** Şehir bazlı alıcı: telefon ve görünen isim (SMS şablonu için) */
export interface CityRecipient {
  phone: string;
  name: string;
}

/** Yağmurlu gün SMS çalıştırma özeti (API response ve log için) */
export interface RainyDaySmsResult {
  citiesChecked: number;
  rainyCitiesCount: number;
  smsSent: number;
  rainyCities: string[];
  errors: string[];
}

/** Yağmurlu gün uyarı SMS şablonu: Sadece gerçekten yağmurlu olan illere gider. {name}, {city} doldurulur. Sonunda Çözüm Net ve dikkatli olun. */
const DEFAULT_MESSAGE_TEMPLATE =
  'Sayın {name}, {city} için bugün yağmurlu hava tahmin edilmektedir. Yol yardım paketiniz 7/24 yanınızda. Dikkatli olun. Çözüm Net';

/** Seçilen müşterilere hava durumlu SMS: {name}, {city}, {weather} */
const WEATHER_MESSAGE_TEMPLATE =
  'Sayın {name}, {city} için bugün hava: {weather}. Yol yardım paketiniz 7/24 yanınızda. Destek: 0850 304 54 40';

/** Seçilen müşterilere hava durumlu SMS sonucu */
export interface SendWeatherToSelectedResult {
  sent: number;
  errors: string[];
}

/**
 * Yağmurlu günlerde şehir bazlı müşteri/üye SMS servisi.
 * Customer (acente müşterileri) ve UserCustomer (bireysel üyeler) tablolarından
 * city + phone dolu kayıtları alır; Open-Meteo ile yağmurlu şehirleri tespit edip
 * sadece o şehirlerdeki numaralara bilgilendirme SMS'i gönderir.
 */
export class RainyDaySmsService {
  private customerRepository = AppDataSource.getRepository(Customer);
  private userCustomerRepository = AppDataSource.getRepository(UserCustomer);
  private weatherService = new WeatherService();
  private smsService = new SmsService();

  /**
   * Tüm şehirleri ve her şehirdeki alıcıları (phone, name) toplar.
   * Customer: name + surname; UserCustomer: name + surname.
   */
  private async getCityRecipients(): Promise<Map<string, CityRecipient[]>> {
    const map = new Map<string, CityRecipient[]>();

    const add = (city: string, phone: string, name: string) => {
      if (!city?.trim() || !phone?.trim()) return;
      const key = city.trim();
      const list = map.get(key) ?? [];
      list.push({ phone: phone.trim(), name: (name || 'Değerli Üyemiz').trim() });
      map.set(key, list);
    };

    // Acente müşterileri: city ve phone dolu olanlar (null ve boş string hariç)
    const customers = await this.customerRepository
      .createQueryBuilder('c')
      .select(['c.city', 'c.phone', 'c.name', 'c.surname'])
      .where('c.city IS NOT NULL AND c.city != :empty AND c.phone IS NOT NULL AND c.phone != :empty', { empty: '' })
      .getMany();
    for (const c of customers) {
      const name = [c.name, c.surname].filter(Boolean).join(' ').trim() || 'Değerli Üyemiz';
      add(c.city!, c.phone, name);
    }

    // Bireysel üyeler: city ve phone dolu olanlar (null ve boş string hariç)
    const userCustomers = await this.userCustomerRepository
      .createQueryBuilder('u')
      .select(['u.city', 'u.phone', 'u.name', 'u.surname'])
      .where('u.city IS NOT NULL AND u.city != :empty AND u.phone IS NOT NULL AND u.phone != :empty', { empty: '' })
      .getMany();
    for (const u of userCustomers) {
      const name = [u.name, u.surname].filter(Boolean).join(' ').trim() || 'Değerli Üyemiz';
      add(u.city!, u.phone, name);
    }

    return map;
  }

  /**
   * Tek şehir için tüm alıcılara kişiselleştirilmiş SMS gönderir.
   * Şablon: {name}, {city} alanları doldurulur.
   */
  private async sendRainySmsForCity(
    city: string,
    recipients: CityRecipient[],
    template: string,
    errors: string[]
  ): Promise<number> {
    let sent = 0;
    for (const r of recipients) {
      try {
        const message = template
          .replace(/\{name\}/g, r.name)
          .replace(/\{city\}/g, city);
        await this.smsService.sendSingleSms(r.phone, message);
        sent++;
      } catch (err: any) {
        const msg = err?.message || String(err);
        errors.push(`${city} / ${r.phone}: ${msg}`);
      }
    }
    return sent;
  }

  /**
   * Bugün yağmurlu tahmin edilen şehirlerdeki müşterilere SMS gönderir.
   * Cron veya manuel tetikleme için kullanılır.
   */
  async runRainyDaySms(): Promise<RainyDaySmsResult> {
    const result: RainyDaySmsResult = {
      citiesChecked: 0,
      rainyCitiesCount: 0,
      smsSent: 0,
      rainyCities: [],
      errors: [],
    };

    const cityRecipients = await this.getCityRecipients();
    const cities = Array.from(cityRecipients.keys());
    result.citiesChecked = cities.length;

    if (cities.length === 0) {
      return result;
    }

    const delayMs = 350; // Open-Meteo fair use için şehirler arası gecikme

    for (const city of cities) {
      const code = await this.weatherService.getWeatherCodeForCity(city);
      if (code === null) {
        result.errors.push(`${city}: Hava durumu alınamadı`);
        continue;
      }
      if (!this.weatherService.isRainyWeatherCode(code)) {
        await sleep(delayMs);
        continue;
      }

      result.rainyCities.push(city);
      const recipients = cityRecipients.get(city) ?? [];
      const sent = await this.sendRainySmsForCity(
        city,
        recipients,
        DEFAULT_MESSAGE_TEMPLATE,
        result.errors
      );
      result.smsSent += sent;
      await sleep(delayMs);
    }

    result.rainyCitiesCount = result.rainyCities.length;
    return result;
  }

  /**
   * Seçilen müşteri ID'lerine, her birinin kayıtlı ilinin hava durumunu içeren kişiselleştirilmiş SMS gönderir.
   * Manuel tetikleme (otomatik yağmurlu gün SMS'inden bağımsız).
   */
  async sendWeatherSmsToCustomerIds(customerIds: string[]): Promise<SendWeatherToSelectedResult> {
    const result: SendWeatherToSelectedResult = { sent: 0, errors: [] };
    if (!customerIds?.length) return result;

    const customers = await this.customerRepository.find({
      where: { id: In(customerIds) },
      select: ['id', 'name', 'surname', 'city', 'phone'],
    });

    const delayMs = 400; // Open-Meteo + NetGSM rate limit için gecikme

    for (const c of customers) {
      if (!c.city?.trim() || !c.phone?.trim()) {
        result.errors.push(`${c.name || c.id}: İl veya telefon boş, atlandı`);
        continue;
      }
      const name = [c.name, c.surname].filter(Boolean).join(' ').trim() || 'Değerli Üyemiz';
      const city = c.city.trim();

      // Open-Meteo ile o şehrin gerçek hava durumu çekilir (dummy değil)
      const code = await this.weatherService.getWeatherCodeForCity(city);
      const weatherDesc = code !== null
        ? this.weatherService.getWeatherDescription(code)
        : 'bilgi alınamadı';

      logger.info(`Hava durumlu SMS: ${city} -> kod=${code ?? 'yok'}, açıklama="${weatherDesc}" -> ${c.phone}`);

      const message = WEATHER_MESSAGE_TEMPLATE
        .replace(/\{name\}/g, name)
        .replace(/\{city\}/g, city)
        .replace(/\{weather\}/g, weatherDesc);

      try {
        await this.smsService.sendSingleSms(c.phone, message);
        result.sent++;
      } catch (err: any) {
        result.errors.push(`${city} / ${c.phone}: ${err?.message || String(err)}`);
      }
      await sleep(delayMs);
    }

    return result;
  }
}

// Şehirler arası gecikme için yardımcı (Open-Meteo fair use)
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
