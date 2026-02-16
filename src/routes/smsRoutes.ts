import { Router } from 'express';
import { SmsController } from '../controllers/SmsController';
import { authMiddleware, superAdminOnly } from '../middlewares';

const router = Router();
const smsController = new SmsController();

// Tüm SMS route'ları auth gerektirir
router.use(authMiddleware);

// Yağmurlu gün SMS: Sadece SUPER_ADMIN manuel tetikleyebilir
router.post('/rainy-day', superAdminOnly, smsController.rainyDaySms);

// Manuel toplu SMS: Seçilen telefon numaralarına aynı mesajı gönder (giriş yapan adminler)
router.post('/send-multiple', smsController.sendToMultiple);

// Seçilen müşterilere kayıtlı ilin hava durumunu içeren kişiselleştirilmiş SMS (manuel)
router.post('/send-weather-selected', smsController.sendWeatherToSelected);

export default router;
