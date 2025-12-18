import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: users tablosuna soft delete kolonlari ekle
 * - is_deleted: boolean, default false
 * - deleted_at: timestamp, nullable
 */
export class AddUserSoftDelete1702130000000 implements MigrationInterface {
    name = 'AddUserSoftDelete1702130000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // is_deleted kolonu ekle (varsayilan olarak false)
        await queryRunner.query(`
            ALTER TABLE \`users\` 
            ADD COLUMN \`is_deleted\` TINYINT(1) NOT NULL DEFAULT 0
        `);
        
        // deleted_at kolonu ekle (nullable timestamp)
        await queryRunner.query(`
            ALTER TABLE \`users\` 
            ADD COLUMN \`deleted_at\` TIMESTAMP NULL DEFAULT NULL
        `);
        
        console.log('Users tablosuna is_deleted ve deleted_at kolonlari eklendi');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Geri alma: kolonlari kaldir
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`deleted_at\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`is_deleted\``);
        
        console.log('Users tablosundan is_deleted ve deleted_at kolonlari kaldirildi');
    }
}

