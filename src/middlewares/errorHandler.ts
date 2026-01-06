import { Request, Response, NextFunction } from 'express';
import { QueryFailedError } from 'typeorm';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
    return;
  }

  if (err instanceof QueryFailedError) {
    console.error('Database query error:', err);
    
    // SQL hata mesajını Türkçe'ye çevir
    const sqlMessage = (err as any).sqlMessage || err.message;
    const errorCode = (err as any).code;
    
    let turkishMessage = 'Veritabanı hatası oluştu';
    let missingField = null;
    
    // Unique constraint hatası
    if (errorCode === 'ER_DUP_ENTRY' || sqlMessage.includes('Duplicate entry')) {
      // Hangi alanın duplicate olduğunu bul
      if (sqlMessage.includes('phone') || sqlMessage.includes('users.phone') || sqlMessage.includes('user_customers.phone')) {
        turkishMessage = 'Bu telefon numarası zaten kullanılıyor. Lütfen farklı bir telefon numarası deneyin.';
        missingField = 'phone';
      } else if (sqlMessage.includes('email') || sqlMessage.includes('users.email')) {
        turkishMessage = 'Bu e-posta adresi zaten kullanılıyor. Lütfen farklı bir e-posta adresi deneyin.';
        missingField = 'email';
      } else if (sqlMessage.includes('tc_vkn') || sqlMessage.includes('customers.tc_vkn')) {
        turkishMessage = 'Bu T.C. Kimlik No / Vergi No zaten kayıtlı. Lütfen kontrol edin.';
        missingField = 'tc_vkn';
      } else if (sqlMessage.includes('plate') || sqlMessage.includes('vehicles.plate')) {
        turkishMessage = 'Bu plaka numarası zaten kayıtlı. Lütfen kontrol edin.';
        missingField = 'plate';
      } else {
        turkishMessage = 'Bu bilgi zaten sistemde kayıtlı. Lütfen kontrol edin.';
      }
    }
    // Foreign key hatası
    else if (errorCode === 'ER_NO_REFERENCED_ROW_2' || sqlMessage.includes('foreign key constraint')) {
      if (sqlMessage.includes('agency_id')) {
        turkishMessage = 'Seçilen broker bulunamadı. Lütfen geçerli bir broker seçin.';
        missingField = 'agency_id';
      } else if (sqlMessage.includes('branch_id')) {
        turkishMessage = 'Seçilen acente bulunamadı. Lütfen geçerli bir acente seçin.';
        missingField = 'branch_id';
      } else if (sqlMessage.includes('package_id')) {
        turkishMessage = 'Seçilen paket bulunamadı. Lütfen geçerli bir paket seçin.';
        missingField = 'package_id';
      } else if (sqlMessage.includes('customer_id')) {
        turkishMessage = 'Müşteri bilgisi bulunamadı. Lütfen müşteri bilgilerini kontrol edin.';
        missingField = 'customer_id';
      } else if (sqlMessage.includes('vehicle_id')) {
        turkishMessage = 'Araç bilgisi bulunamadı. Lütfen araç bilgilerini kontrol edin.';
        missingField = 'vehicle_id';
      } else {
        turkishMessage = 'İlişkili kayıt bulunamadı. Lütfen tüm bilgileri kontrol edin.';
      }
    }
    // NOT NULL constraint hatası
    else if (errorCode === 'ER_BAD_NULL_ERROR' || sqlMessage.includes('cannot be null')) {
      // Hangi alanın null olduğunu bul
      const fieldMatch = sqlMessage.match(/Column '(\w+)'/);
      if (fieldMatch) {
        const field = fieldMatch[1];
        const fieldNames: Record<string, string> = {
          'name': 'Ad',
          'surname': 'Soyad',
          'phone': 'Telefon',
          'email': 'E-posta',
          'tc_vkn': 'T.C. Kimlik No / Vergi No',
          'plate': 'Plaka',
          'package_id': 'Paket',
          'price': 'Fiyat',
          'start_date': 'Başlangıç Tarihi',
          'end_date': 'Bitiş Tarihi',
          'agency_id': 'Broker',
          'branch_id': 'Acente',
        };
        const fieldName = fieldNames[field] || field;
        turkishMessage = `${fieldName} alanı zorunludur ve boş bırakılamaz.`;
        missingField = field;
      } else {
        turkishMessage = 'Zorunlu bir alan eksik. Lütfen tüm zorunlu alanları doldurun.';
      }
    }
    // Data too long hatası
    else if (errorCode === 'ER_DATA_TOO_LONG' || sqlMessage.includes('Data too long')) {
      const fieldMatch = sqlMessage.match(/Column '(\w+)'/);
      if (fieldMatch) {
        const field = fieldMatch[1];
        turkishMessage = `${field} alanı çok uzun. Lütfen daha kısa bir değer girin.`;
        missingField = field;
      } else {
        turkishMessage = 'Girilen veri çok uzun. Lütfen daha kısa bir değer girin.';
      }
    }
    
    res.status(400).json({
      error: turkishMessage,
      ...(missingField && { missingField }),
      ...(process.env.NODE_ENV === 'development' && {
        originalMessage: err.message,
        sqlMessage: sqlMessage,
        code: errorCode,
        stack: err.stack
      }),
    });
    return;
  }

  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      message: err.message,
      stack: err.stack
    }),
  });
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
