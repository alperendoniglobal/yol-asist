import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Şube PDF sözleşmesi logosu (opsiyonel).
 * Örnek: /uploads/branch-logo/firma.jpg → public altında uploads mount ile sunulur.
 */
export class AddBranchPdfLogoPath1702200000022 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('branches');
    const exists = table?.columns.find((c) => c.name === 'pdf_logo_path');
    if (exists) return;

    await queryRunner.addColumn(
      'branches',
      new TableColumn({
        name: 'pdf_logo_path',
        type: 'varchar',
        length: '512',
        isNullable: true,
        comment: 'PDF üstünde kullanılacak logo URL yolu (örn. /uploads/branch-logo/x.jpg); boşsa varsayılan Çözüm Asistan logosu',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('branches');
    const col = table?.columns.find((c) => c.name === 'pdf_logo_path');
    if (!col) return;
    await queryRunner.dropColumn('branches', 'pdf_logo_path');
  }
}
