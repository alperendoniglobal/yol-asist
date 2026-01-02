import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';
import { Agency } from '../entities/Agency';
import { ContractVersion } from '../entities/ContractVersion';
import { UserRole } from '../types/enums';

/**
 * Sözleşme Kontrol Middleware'i
 * Acente kullanıcıları için sözleşme onayı kontrolü yapar.
 * Sözleşme kabul edilmemişse işlem engellenir ve uygun hata döndürülür.
 */

/**
 * Sözleşme onayı gerektiren işlemler için middleware
 * - Satış yapma
 * - Kullanıcı ekleme
 * - Şube ekleme
 * - Müşteri ekleme
 * - Araç ekleme
 * - vb.
 */
export const requireContractAcceptance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Super admin için kontrol yapma (sözleşme gerektirmez)
    if (req.user?.role === UserRole.SUPER_ADMIN) {
      return next();
    }

    // Kullanıcı bilgisi yoksa devam et (auth middleware'i yakalayacak)
    if (!req.user?.agency_id) {
      return next();
    }

    // Acente bilgisini al
    const agencyRepository = AppDataSource.getRepository(Agency);
    const agency = await agencyRepository.findOne({
      where: { id: req.user.agency_id },
    });

    // Acente bulunamazsa devam et (diğer middleware'ler yakalayacak)
    if (!agency) {
      return next();
    }

    // Sözleşme kabul edilmemişse engelle
    if (!agency.contract_accepted) {
      res.status(403).json({
        success: false,
        code: 'CONTRACT_NOT_ACCEPTED',
        message: 'Devam etmek için sözleşmeyi kabul etmeniz gerekmektedir.',
        redirect: '/contract-acceptance',
      });
      return;
    }

    // Aktif sözleşme versiyonunu kontrol et
    const contractVersionRepository = AppDataSource.getRepository(ContractVersion);
    const currentVersion = await contractVersionRepository.findOne({
      where: { is_active: true },
    });

    // Versiyon farklıysa yeniden onay gerekli
    if (currentVersion && agency.accepted_contract_version !== currentVersion.version) {
      // Acente sözleşme durumunu güncelle
      agency.contract_accepted = false;
      await agencyRepository.save(agency);

      res.status(403).json({
        success: false,
        code: 'CONTRACT_VERSION_CHANGED',
        message: 'Sözleşme güncellenmiştir. Devam etmek için yeni sözleşmeyi kabul etmeniz gerekmektedir.',
        redirect: '/contract-acceptance',
        currentVersion: currentVersion.version,
        acceptedVersion: agency.accepted_contract_version,
      });
      return;
    }

    // Sözleşme kabul edilmiş, devam et
    next();
  } catch (error) {
    // Hata durumunda devam et (diğer middleware'ler yakalayacak)
    console.error('Contract check middleware error:', error);
    next();
  }
};

/**
 * Sadece sözleşme durumunu kontrol eden middleware (engellemez)
 * Response header'ına sözleşme durumunu ekler
 */
export const checkContractStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Super admin için kontrol yapma
    if (req.user?.role === UserRole.SUPER_ADMIN) {
      return next();
    }

    if (!req.user?.agency_id) {
      return next();
    }

    const agencyRepository = AppDataSource.getRepository(Agency);
    const agency = await agencyRepository.findOne({
      where: { id: req.user.agency_id },
    });

    if (agency) {
      // Header'a sözleşme durumunu ekle
      res.setHeader('X-Contract-Accepted', agency.contract_accepted ? 'true' : 'false');
      res.setHeader('X-Contract-Version', agency.accepted_contract_version || 'none');
    }

    next();
  } catch (error) {
    console.error('Contract status check error:', error);
    next();
  }
};

