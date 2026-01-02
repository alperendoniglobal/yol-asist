import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sözleşme Tabloları Migration
 */
export class CreateContractTables1702200000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. agencies tablosuna sözleşme kolonları ekle (tek tek)
    const columns = await queryRunner.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'yol_asistan' AND TABLE_NAME = 'agencies'
    `);
    const columnNames = columns.map((c: any) => c.COLUMN_NAME);

    if (!columnNames.includes('contract_accepted')) {
      await queryRunner.query(`ALTER TABLE agencies ADD COLUMN contract_accepted BOOLEAN DEFAULT FALSE`);
    }
    if (!columnNames.includes('accepted_contract_version')) {
      await queryRunner.query(`ALTER TABLE agencies ADD COLUMN accepted_contract_version VARCHAR(20) NULL`);
    }
    if (!columnNames.includes('contract_accepted_at')) {
      await queryRunner.query(`ALTER TABLE agencies ADD COLUMN contract_accepted_at TIMESTAMP NULL`);
    }

    // 2. contract_versions tablosunu oluştur
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS contract_versions (
        id VARCHAR(36) PRIMARY KEY,
        version VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content LONGTEXT NOT NULL,
        is_active BOOLEAN DEFAULT FALSE,
        summary TEXT,
        change_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 3. agency_contract_acceptances tablosunu oluştur
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agency_contract_acceptances (
        id VARCHAR(36) PRIMARY KEY,
        agency_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        contract_version_id VARCHAR(36) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT NOT NULL,
        checkbox1_accepted BOOLEAN DEFAULT FALSE,
        checkbox2_accepted BOOLEAN DEFAULT FALSE,
        scroll_completed BOOLEAN DEFAULT FALSE,
        accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (contract_version_id) REFERENCES contract_versions(id) ON DELETE CASCADE
      )
    `);

    // 4. Varsayılan sözleşme versiyonu ekle
    const existingContract = await queryRunner.query(`SELECT id FROM contract_versions WHERE version = '1.0' LIMIT 1`);
    if (existingContract.length === 0) {
      await queryRunner.query(`
        INSERT INTO contract_versions (id, version, title, content, is_active, summary) VALUES (
          UUID(),
          '1.0',
          'Acente Hizmet Sözleşmesi',
          '<h1>ACENTE HİZMET SÖZLEŞMESİ</h1>
          <h2>1. TARAFLAR</h2>
          <p>Bu sözleşme, Şirket ile Acente arasında akdedilmiştir.</p>
          <h2>2. KONU</h2>
          <p>Yol yardım hizmet paketlerinin satışına ilişkin koşulları düzenler.</p>
          <h2>3. ÖNEMLİ UYARI</h2>
          <p style="color:red;font-weight:bold;">Bu hizmetler SİGORTA ÜRÜNLERİ DEĞİLDİR.</p>
          <h2>4. YÜRÜRLÜK</h2>
          <p>Elektronik onay ile yürürlüğe girer.</p>',
          true,
          'Acente hizmet sözleşmesi'
        )
      `);
    }

    console.log('✅ Sözleşme tabloları oluşturuldu.');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS agency_contract_acceptances`);
    await queryRunner.query(`DROP TABLE IF EXISTS contract_versions`);
    
    // Kolonları sil (varsa)
    try { await queryRunner.query(`ALTER TABLE agencies DROP COLUMN contract_accepted`); } catch (e) {}
    try { await queryRunner.query(`ALTER TABLE agencies DROP COLUMN accepted_contract_version`); } catch (e) {}
    try { await queryRunner.query(`ALTER TABLE agencies DROP COLUMN contract_accepted_at`); } catch (e) {}
  }
}
