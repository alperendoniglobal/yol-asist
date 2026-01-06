import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: users tablosundaki role enum'ına SUPER_AGENCY_ADMIN değerini ekle
 * SUPER_AGENCY_ADMIN rolü - Süper Broker Yöneticisi
 * Birden fazla broker yönetebilir ve yeni broker oluşturabilir
 */
export class AddSuperAgencyAdminRoleToUsers1702200000019 implements MigrationInterface {
    name = 'AddSuperAgencyAdminRoleToUsers1702200000019'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // role enum'ına SUPER_AGENCY_ADMIN değerini ekle
        // Mevcut enum değerleri: SUPER_ADMIN, AGENCY_ADMIN, BRANCH_ADMIN, BRANCH_USER, SUPPORT
        // Yeni değer: SUPER_AGENCY_ADMIN (SUPER_ADMIN'den sonra ekleniyor)
        await queryRunner.query(`
            ALTER TABLE \`users\` 
            MODIFY COLUMN \`role\` ENUM('SUPER_ADMIN', 'SUPER_AGENCY_ADMIN', 'AGENCY_ADMIN', 'BRANCH_ADMIN', 'BRANCH_USER', 'SUPPORT', 'USER') 
            NOT NULL DEFAULT 'BRANCH_USER'
        `);
        
        console.log('✅ Users tablosundaki role enum\'ına SUPER_AGENCY_ADMIN değeri eklendi');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Geri alma: SUPER_AGENCY_ADMIN değerini enum'dan kaldır
        // Önce SUPER_AGENCY_ADMIN rolündeki kullanıcıları başka bir role değiştirmek gerekebilir
        // Bu migration'da sadece enum'ı eski haline döndürüyoruz
        await queryRunner.query(`
            ALTER TABLE \`users\` 
            MODIFY COLUMN \`role\` ENUM('SUPER_ADMIN', 'AGENCY_ADMIN', 'BRANCH_ADMIN', 'BRANCH_USER', 'SUPPORT', 'USER') 
            NOT NULL DEFAULT 'BRANCH_USER'
        `);
        
        console.log('⬇️ Users tablosundaki role enum\'ından SUPER_AGENCY_ADMIN değeri kaldırıldı');
    }
}

