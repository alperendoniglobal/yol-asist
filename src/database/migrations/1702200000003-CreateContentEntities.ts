import { MigrationInterface, QueryRunner, Table, TableColumn } from "typeorm";

/**
 * Migration: Landing Page CMS Entity'lerini oluştur
 * LandingPageContent, LandingPageBanner, LandingPageFeature, LandingPageStat, PageContent
 */
export class CreateContentEntities1702200000003 implements MigrationInterface {
    name = 'CreateContentEntities1702200000003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Landing Page Content (Genel Ayarlar)
        await queryRunner.createTable(
            new Table({
                name: 'landing_page_content',
                columns: [
                    {
                        name: 'id',
                        type: 'varchar',
                        length: '36',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: '(UUID())',
                    },
                    {
                        name: 'support_phone',
                        type: 'varchar',
                        length: '50',
                        default: "'+90 (850) 304 54 40'",
                    },
                    {
                        name: 'support_email',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'company_name',
                        type: 'varchar',
                        length: '255',
                        default: "'Çözüm Asistan'",
                    },
                    {
                        name: 'company_address',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'meta_title',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'meta_description',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'meta_keywords',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true
        );

        // Landing Page Banners
        await queryRunner.createTable(
            new Table({
                name: 'landing_page_banners',
                columns: [
                    {
                        name: 'id',
                        type: 'varchar',
                        length: '36',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: '(UUID())',
                    },
                    {
                        name: 'image_path',
                        type: 'varchar',
                        length: '500',
                    },
                    {
                        name: 'badge',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'left_content',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'right_content',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'banner_stats',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'order',
                        type: 'int',
                        default: 0,
                    },
                    {
                        name: 'is_active',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true
        );

        // Landing Page Features
        await queryRunner.createTable(
            new Table({
                name: 'landing_page_features',
                columns: [
                    {
                        name: 'id',
                        type: 'varchar',
                        length: '36',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: '(UUID())',
                    },
                    {
                        name: 'icon_name',
                        type: 'varchar',
                        length: '100',
                    },
                    {
                        name: 'title',
                        type: 'varchar',
                        length: '255',
                    },
                    {
                        name: 'description',
                        type: 'text',
                    },
                    {
                        name: 'gradient',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'order',
                        type: 'int',
                        default: 0,
                    },
                    {
                        name: 'is_active',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true
        );

        // Landing Page Stats
        await queryRunner.createTable(
            new Table({
                name: 'landing_page_stats',
                columns: [
                    {
                        name: 'id',
                        type: 'varchar',
                        length: '36',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: '(UUID())',
                    },
                    {
                        name: 'label',
                        type: 'varchar',
                        length: '255',
                    },
                    {
                        name: 'value',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                    },
                    {
                        name: 'suffix',
                        type: 'varchar',
                        length: '10',
                        isNullable: true,
                    },
                    {
                        name: 'icon_name',
                        type: 'varchar',
                        length: '100',
                    },
                    {
                        name: 'order',
                        type: 'int',
                        default: 0,
                    },
                    {
                        name: 'is_active',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true
        );

        // Page Contents
        await queryRunner.createTable(
            new Table({
                name: 'page_contents',
                columns: [
                    {
                        name: 'id',
                        type: 'varchar',
                        length: '36',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: '(UUID())',
                    },
                    {
                        name: 'slug',
                        type: 'varchar',
                        length: '100',
                        isUnique: true,
                    },
                    {
                        name: 'title',
                        type: 'varchar',
                        length: '255',
                    },
                    {
                        name: 'content',
                        type: 'longtext',
                    },
                    {
                        name: 'meta_title',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'meta_description',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'meta_keywords',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'is_active',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true
        );

        console.log('Content entity tabloları oluşturuldu');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Geri alma: Tabloları sil
        await queryRunner.dropTable('page_contents');
        await queryRunner.dropTable('landing_page_stats');
        await queryRunner.dropTable('landing_page_features');
        await queryRunner.dropTable('landing_page_banners');
        await queryRunner.dropTable('landing_page_content');
        
        console.log('Content entity tabloları kaldırıldı');
    }
}

