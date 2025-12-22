import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: users tablosundaki role enum'ına SUPPORT değerini ekle
 * SUPPORT rolü sadece SUPER_ADMIN tarafından oluşturulabilir
 */
export class AddSupportRoleToUsers1702200000002 implements MigrationInterface {
    name = 'AddSupportRoleToUsers1702200000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // role enum'ına SUPPORT değerini ekle
        // Mevcut enum değerleri: SUPER_ADMIN, AGENCY_ADMIN, BRANCH_ADMIN, BRANCH_USER
        // Yeni değer: SUPPORT
        await queryRunner.query(`
            ALTER TABLE \`users\` 
            MODIFY COLUMN \`role\` ENUM('SUPER_ADMIN', 'AGENCY_ADMIN', 'BRANCH_ADMIN', 'BRANCH_USER', 'SUPPORT') 
            NOT NULL DEFAULT 'BRANCH_USER'
        `);
        
        console.log('Users tablosundaki role enum\'ına SUPPORT değeri eklendi');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Geri alma: SUPPORT değerini enum'dan kaldır
        // Önce SUPPORT rolündeki kullanıcıları başka bir role değiştirmek gerekebilir
        // Bu migration'da sadece enum'ı eski haline döndürüyoruz
        await queryRunner.query(`
            ALTER TABLE \`users\` 
            MODIFY COLUMN \`role\` ENUM('SUPER_ADMIN', 'AGENCY_ADMIN', 'BRANCH_ADMIN', 'BRANCH_USER') 
            NOT NULL DEFAULT 'BRANCH_USER'
        `);
        
        console.log('Users tablosundaki role enum\'ından SUPPORT değeri kaldırıldı');
    }
}

