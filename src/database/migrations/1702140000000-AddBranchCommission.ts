import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Branch tablosuna komisyon oranı ve bakiye alanları ekler
 * Her şubenin kendi komisyon oranı ZORUNLUDUR
 * Şube komisyonu acente komisyonundan fazla OLAMAZ
 */
export class AddBranchCommission1702140000000 implements MigrationInterface {
  name = 'AddBranchCommission1702140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Şube komisyon oranı alanı ekle - ZORUNLU alan
    // Varsayılan değer 20 (acente eklerken değiştirmesi gerekecek)
    await queryRunner.addColumn(
      'branches',
      new TableColumn({
        name: 'commission_rate',
        type: 'decimal',
        precision: 5,
        scale: 2,
        isNullable: false,
        default: 20, // Varsayılan %20, mevcut kayıtlar için
        comment: 'Şube komisyon oranı (%). Zorunlu alan, acente oranından fazla olamaz.'
      })
    );

    // Şube bakiye alanı ekle
    // Şubenin biriken komisyon bakiyesi
    await queryRunner.addColumn(
      'branches',
      new TableColumn({
        name: 'balance',
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: 0,
        comment: 'Şube komisyon bakiyesi (TL)'
      })
    );

    console.log('✅ Branch tablosuna commission_rate ve balance alanları eklendi');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Alanları kaldır
    await queryRunner.dropColumn('branches', 'commission_rate');
    await queryRunner.dropColumn('branches', 'balance');
    
    console.log('⬇️ Branch tablosundan commission_rate ve balance alanları kaldırıldı');
  }
}

