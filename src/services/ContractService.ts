import { AppDataSource } from '../config/database';
import { ContractVersion } from '../entities/ContractVersion';
import { AgencyContractAcceptance } from '../entities/AgencyContractAcceptance';
import { Agency } from '../entities/Agency';
import { User } from '../entities/User';
import { AppError } from '../middlewares/errorHandler';

/**
 * Sözleşme Servisi
 * Sözleşme versiyonları ve acente onaylarını yönetir.
 * Click-wrap uyumluluğu için tüm onayları loglar.
 */
export class ContractService {
  // Repository referansları
  private contractVersionRepository = AppDataSource.getRepository(ContractVersion);
  private acceptanceRepository = AppDataSource.getRepository(AgencyContractAcceptance);
  private agencyRepository = AppDataSource.getRepository(Agency);
  private userRepository = AppDataSource.getRepository(User);

  /**
   * Aktif sözleşme versiyonunu getirir
   * Acente sözleşme sayfasında bu versiyonu gösterir
   */
  async getCurrentVersion(): Promise<ContractVersion | null> {
    return this.contractVersionRepository.findOne({
      where: { is_active: true },
    });
  }

  /**
   * Belirli bir sözleşme versiyonunu getirir
   */
  async getVersionById(id: string): Promise<ContractVersion | null> {
    return this.contractVersionRepository.findOne({
      where: { id },
    });
  }

  /**
   * Tüm sözleşme versiyonlarını getirir (admin için)
   */
  async getAllVersions(): Promise<ContractVersion[]> {
    return this.contractVersionRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Yeni sözleşme versiyonu oluşturur (super admin)
   * Eski aktif versiyon varsa pasif yapar
   */
  async createVersion(data: {
    version: string;
    title: string;
    content: string;
    summary?: string;
    change_notes?: string;
    is_active?: boolean;
  }): Promise<ContractVersion> {
    // Eğer yeni versiyon aktif olacaksa, mevcut aktif versiyonu pasif yap
    if (data.is_active) {
      await this.contractVersionRepository.update(
        { is_active: true },
        { is_active: false }
      );

      // Tüm acentelerin sözleşme kabulünü sıfırla (yeniden onay gerekli)
      await this.agencyRepository.update(
        {},
        { contract_accepted: false }
      );
    }

    // Yeni versiyonu oluştur
    const version = this.contractVersionRepository.create({
      ...data,
      is_active: data.is_active ?? false,
    });

    return this.contractVersionRepository.save(version);
  }

  /**
   * Sözleşme versiyonunu günceller (super admin)
   */
  async updateVersion(
    id: string,
    data: {
      version?: string;
      title?: string;
      content?: string;
      summary?: string;
      change_notes?: string;
      is_active?: boolean;
    }
  ): Promise<ContractVersion> {
    const existingVersion = await this.contractVersionRepository.findOne({
      where: { id },
    });

    if (!existingVersion) {
      throw new AppError(404, 'Sözleşme versiyonu bulunamadı');
    }

    // Eğer bu versiyon aktif yapılıyorsa, diğerlerini pasif yap
    if (data.is_active && !existingVersion.is_active) {
      await this.contractVersionRepository.update(
        { is_active: true },
        { is_active: false }
      );

      // Tüm acentelerin sözleşme kabulünü sıfırla
      await this.agencyRepository.update(
        {},
        { contract_accepted: false }
      );
    }

    // Versiyonu güncelle
    Object.assign(existingVersion, data);
    return this.contractVersionRepository.save(existingVersion);
  }

  /**
   * Bir versiyonu aktif yapar ve diğerlerini pasif yapar
   * Bu, tüm acentelerin yeniden onay vermesini gerektirir
   */
  async activateVersion(id: string): Promise<ContractVersion> {
    const version = await this.contractVersionRepository.findOne({
      where: { id },
    });

    if (!version) {
      throw new AppError(404, 'Sözleşme versiyonu bulunamadı');
    }

    // Diğer versiyonları pasif yap
    await this.contractVersionRepository.update(
      { is_active: true },
      { is_active: false }
    );

    // Bu versiyonu aktif yap
    version.is_active = true;
    await this.contractVersionRepository.save(version);

    // Tüm acentelerin sözleşme kabulünü sıfırla
    await this.agencyRepository.update(
      {},
      { contract_accepted: false }
    );

    return version;
  }

  /**
   * Acente için sözleşme durumunu kontrol eder
   */
  async checkContractStatus(agencyId: string): Promise<{
    accepted: boolean;
    currentVersion: string | null;
    acceptedVersion: string | null;
    needsReacceptance: boolean;
  }> {
    const agency = await this.agencyRepository.findOne({
      where: { id: agencyId },
    });

    if (!agency) {
      throw new AppError(404, 'Acente bulunamadı');
    }

    const currentVersion = await this.getCurrentVersion();

    // Sözleşme kabul edilmemişse veya versiyon farklıysa yeniden onay gerekli
    const needsReacceptance: boolean = !agency.contract_accepted || 
      (currentVersion !== null && agency.accepted_contract_version !== currentVersion.version);

    return {
      accepted: agency.contract_accepted && !needsReacceptance,
      currentVersion: currentVersion?.version || null,
      acceptedVersion: agency.accepted_contract_version,
      needsReacceptance,
    };
  }

  /**
   * Sözleşmeyi onaylar ve log kaydı oluşturur
   * Click-wrap uyumluluğu için tüm bilgileri saklar
   */
  async acceptContract(data: {
    agencyId: string;
    userId: string;
    ipAddress: string;
    userAgent: string;
    checkbox1Accepted: boolean;
    checkbox2Accepted: boolean;
    scrollCompleted: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    acceptance: AgencyContractAcceptance;
  }> {
    // Validasyonlar
    if (!data.checkbox1Accepted) {
      throw new AppError(400, 'Sözleşmeyi okuduğunuzu ve anladığınızı onaylamalısınız');
    }

    if (!data.checkbox2Accepted) {
      throw new AppError(400, 'Bu hizmetin sigorta ürünü olmadığını kabul etmelisiniz');
    }

    if (!data.scrollCompleted) {
      throw new AppError(400, 'Lütfen sözleşme metnini sonuna kadar okuyun');
    }

    // Aktif sözleşme versiyonunu al
    const currentVersion = await this.getCurrentVersion();
    if (!currentVersion) {
      throw new AppError(404, 'Aktif sözleşme versiyonu bulunamadı');
    }

    // Acente ve kullanıcıyı kontrol et
    const agency = await this.agencyRepository.findOne({
      where: { id: data.agencyId },
    });

    if (!agency) {
      throw new AppError(404, 'Acente bulunamadı');
    }

    const user = await this.userRepository.findOne({
      where: { id: data.userId },
    });

    if (!user) {
      throw new AppError(404, 'Kullanıcı bulunamadı');
    }

    // Onay kaydı oluştur (log)
    const acceptance = this.acceptanceRepository.create({
      agency_id: data.agencyId,
      user_id: data.userId,
      contract_version_id: currentVersion.id,
      ip_address: data.ipAddress,
      user_agent: data.userAgent,
      checkbox1_accepted: data.checkbox1Accepted,
      checkbox2_accepted: data.checkbox2Accepted,
      scroll_completed: data.scrollCompleted,
    });

    await this.acceptanceRepository.save(acceptance);

    // Acentenin sözleşme durumunu güncelle
    agency.contract_accepted = true;
    agency.accepted_contract_version = currentVersion.version;
    agency.contract_accepted_at = new Date();
    await this.agencyRepository.save(agency);

    return {
      success: true,
      message: 'Sözleşme başarıyla onaylandı',
      acceptance,
    };
  }

  /**
   * Belirli bir acentenin onay geçmişini getirir
   */
  async getAgencyAcceptanceHistory(agencyId: string): Promise<AgencyContractAcceptance[]> {
    return this.acceptanceRepository.find({
      where: { agency_id: agencyId },
      relations: ['user', 'contractVersion'],
      order: { accepted_at: 'DESC' },
    });
  }

  /**
   * Tüm onay raporunu getirir (super admin için)
   */
  async getAcceptanceReport(filters?: {
    startDate?: Date;
    endDate?: Date;
    version?: string;
  }): Promise<{
    total: number;
    accepted: number;
    pending: number;
    acceptances: AgencyContractAcceptance[];
  }> {
    // Tüm acenteler
    const totalAgencies = await this.agencyRepository.count();

    // Sözleşme kabul etmiş acenteler
    const acceptedAgencies = await this.agencyRepository.count({
      where: { contract_accepted: true },
    });

    // Onay kayıtları
    const queryBuilder = this.acceptanceRepository
      .createQueryBuilder('acceptance')
      .leftJoinAndSelect('acceptance.agency', 'agency')
      .leftJoinAndSelect('acceptance.user', 'user')
      .leftJoinAndSelect('acceptance.contractVersion', 'contractVersion')
      .orderBy('acceptance.accepted_at', 'DESC');

    // Tarih filtreleri
    if (filters?.startDate) {
      queryBuilder.andWhere('acceptance.accepted_at >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters?.endDate) {
      queryBuilder.andWhere('acceptance.accepted_at <= :endDate', {
        endDate: filters.endDate,
      });
    }

    // Versiyon filtresi
    if (filters?.version) {
      queryBuilder.andWhere('contractVersion.version = :version', {
        version: filters.version,
      });
    }

    const acceptances = await queryBuilder.getMany();

    return {
      total: totalAgencies,
      accepted: acceptedAgencies,
      pending: totalAgencies - acceptedAgencies,
      acceptances,
    };
  }

  /**
   * Sözleşmeyi PDF formatında döndürür (Base64)
   * Not: Gerçek PDF oluşturma için puppeteer veya pdfkit kullanılabilir
   */
  async getContractAsPdf(versionId?: string): Promise<{
    content: string;
    version: string;
    title: string;
  }> {
    let version: ContractVersion | null;

    if (versionId) {
      version = await this.getVersionById(versionId);
    } else {
      version = await this.getCurrentVersion();
    }

    if (!version) {
      throw new AppError(404, 'Sözleşme versiyonu bulunamadı');
    }

    // HTML içeriği döndür (frontend'de PDF oluşturulabilir)
    return {
      content: version.content,
      version: version.version,
      title: version.title,
    };
  }
}

