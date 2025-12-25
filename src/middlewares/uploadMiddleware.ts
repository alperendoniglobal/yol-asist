import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Upload klasörü yolu
const UPLOAD_DIR = path.join(__dirname, '../../public/uploads/banners');

// Klasör yoksa oluştur
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Dosya storage konfigürasyonu
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    // Dosya adını benzersiz yap: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// Dosya filtreleme (sadece jpg, jpeg, png)
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Sadece JPG, JPEG ve PNG dosyaları yüklenebilir.'));
  }
};

// Multer konfigürasyonu
export const uploadBanner = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB maksimum
  },
  fileFilter: fileFilter,
});

// Static dosyalar için middleware (public klasörünü serve etmek için)
export const staticFilesPath = path.join(__dirname, '../../public');

