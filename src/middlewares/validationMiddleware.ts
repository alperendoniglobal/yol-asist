import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

export const validationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Hata mesajlarını Türkçe'ye çevir
    const turkishErrors = errors.array().map((err: any) => {
      let message = err.msg;
      
      // Yaygın hata mesajlarını Türkçe'ye çevir
      if (message.includes('required')) {
        const field = err.param || 'alan';
        const fieldNames: Record<string, string> = {
          'name': 'Ad',
          'surname': 'Soyad',
          'email': 'E-posta',
          'phone': 'Telefon',
          'password': 'Şifre',
          'tc_vkn': 'T.C. Kimlik No / Vergi No',
          'plate': 'Plaka',
          'package_id': 'Paket',
          'price': 'Fiyat',
          'start_date': 'Başlangıç Tarihi',
          'end_date': 'Bitiş Tarihi',
        };
        const fieldName = fieldNames[field] || field;
        message = `${fieldName} alanı zorunludur`;
      } else if (message.includes('must be')) {
        message = message.replace('must be', 'olmalıdır');
      } else if (message.includes('Invalid')) {
        message = message.replace('Invalid', 'Geçersiz');
      }
      
      return {
        ...err,
        msg: message,
        field: err.param,
      };
    });
    
    res.status(400).json({
      error: 'Doğrulama hatası',
      message: turkishErrors.map((e: any) => e.msg).join(', '),
      errors: turkishErrors,
    });
    return;
  }

  next();
};

export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    for (const validation of validations) {
      await validation.run(req);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Hata mesajlarını Türkçe'ye çevir
      const turkishErrors = errors.array().map((err: any) => {
        let message = err.msg;
        
        // Yaygın hata mesajlarını Türkçe'ye çevir
        if (message.includes('required')) {
          const field = err.param || 'alan';
          const fieldNames: Record<string, string> = {
            'name': 'Ad',
            'surname': 'Soyad',
            'email': 'E-posta',
            'phone': 'Telefon',
            'password': 'Şifre',
            'tc_vkn': 'T.C. Kimlik No / Vergi No',
            'plate': 'Plaka',
            'package_id': 'Paket',
            'price': 'Fiyat',
            'start_date': 'Başlangıç Tarihi',
            'end_date': 'Bitiş Tarihi',
          };
          const fieldName = fieldNames[field] || field;
          message = `${fieldName} alanı zorunludur`;
        } else if (message.includes('must be')) {
          message = message.replace('must be', 'olmalıdır');
        } else if (message.includes('Invalid')) {
          message = message.replace('Invalid', 'Geçersiz');
        }
        
        return {
          ...err,
          msg: message,
          field: err.param,
        };
      });
      
      res.status(400).json({
        error: 'Doğrulama hatası',
        message: turkishErrors.map((e: any) => e.msg).join(', '),
        errors: turkishErrors,
      });
      return;
    }

    next();
  };
};
