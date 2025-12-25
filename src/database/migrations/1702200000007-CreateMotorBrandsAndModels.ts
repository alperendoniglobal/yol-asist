import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Motor markaları ve modelleri için tabloları oluşturur
 * motor.json dosyasındaki verileri parse edip veritabanına ekler
 */
export class CreateMotorBrandsAndModels1702200000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // motor_brands tablosunu oluştur
    await queryRunner.createTable(
      new Table({
        name: 'motor_brands',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
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

    // motor_models tablosunu oluştur
    await queryRunner.createTable(
      new Table({
        name: 'motor_models',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'brand_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '500',
            isNullable: false,
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

    // Foreign key ekle - Duplicate kontrolü ile
    const motorModelsTable = await queryRunner.getTable('motor_models');
    const existingForeignKeys = motorModelsTable?.foreignKeys || [];
    
    // brand_id için foreign key var mı kontrol et
    const brandFkExists = existingForeignKeys.some(
      fk => fk.columnNames.includes('brand_id') && fk.referencedTableName === 'motor_brands'
    );
    
    if (!brandFkExists) {
      await queryRunner.createForeignKey(
        'motor_models',
        new TableForeignKey({
          name: 'FK_motor_models_brand_id', // Manuel isim veriyoruz
          columnNames: ['brand_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'motor_brands',
          onDelete: 'CASCADE',
        })
      );
      console.log('motor_models -> motor_brands foreign key eklendi.');
    } else {
      console.log('motor_models -> motor_brands foreign key zaten mevcut, atlandı.');
    }

    // Index ekle (performans için) - Duplicate kontrolü ile
    const existingIndexes = motorModelsTable?.indices || [];
    const indexExists = existingIndexes.some(
      idx => idx.name === 'IDX_motor_models_brand_id'
    );
    
    if (!indexExists) {
      await queryRunner.createIndex(
        'motor_models',
        new TableIndex({
          name: 'IDX_motor_models_brand_id',
          columnNames: ['brand_id'],
        })
      );
      console.log('IDX_motor_models_brand_id index eklendi.');
    } else {
      console.log('IDX_motor_models_brand_id index zaten mevcut, atlandı.');
    }

    // motor.json dosyasını oku ve verileri ekle
    // Migration çalıştığında __dirname backend/src/database/migrations olacak (compile edilmiş: dist/src/database/migrations)
    // motor.json backend/ klasöründe
    // Önce dist klasöründen, sonra src klasöründen kontrol et
    let motorJsonPath = path.join(__dirname, '../../../motor.json');
    if (!fs.existsSync(motorJsonPath)) {
      // Eğer dist'ten çalışıyorsa, bir seviye daha yukarı çık
      motorJsonPath = path.join(__dirname, '../../../../motor.json');
    }
    if (!fs.existsSync(motorJsonPath)) {
      // Son çare: process.cwd() kullan (backend klasörü)
      motorJsonPath = path.join(process.cwd(), 'motor.json');
    }
    
    if (!fs.existsSync(motorJsonPath)) {
      console.warn('motor.json dosyası bulunamadı, tablolar boş oluşturuldu.');
      console.warn('Aranan path:', motorJsonPath);
      return;
    }
    
    console.log('motor.json dosyası bulundu:', motorJsonPath);

    const motorData = JSON.parse(fs.readFileSync(motorJsonPath, 'utf-8'));
    const brands = motorData.data?.brands || {};

    // Mevcut markaları kontrol et (duplicate önlemek için)
    const existingBrands = await queryRunner.query(`SELECT id, name FROM motor_brands`);
    const existingBrandMap = new Map<string, number>();
    existingBrands.forEach((brand: { id: number; name: string }) => {
      existingBrandMap.set(brand.name, brand.id);
    });

    // Markaları ekle
    const brandMap = new Map<string, number>(); // Marka adı -> ID mapping
    let newBrandsCount = 0;
    let existingBrandsCount = 0;
    
    for (const [brandName, models] of Object.entries(brands)) {
      if (Array.isArray(models) && models.length > 0) {
        let brandId: number;
        
        // Marka zaten var mı kontrol et
        if (existingBrandMap.has(brandName)) {
          brandId = existingBrandMap.get(brandName)!;
          existingBrandsCount++;
        } else {
          // Markayı ekle ve ID'yi al
          await queryRunner.query(
            `INSERT INTO motor_brands (name, created_at, updated_at) VALUES (?, NOW(), NOW())`,
            [brandName]
          );
          
          // Son eklenen markanın ID'sini al
          const brandIdResult = await queryRunner.query(`SELECT LAST_INSERT_ID() as id`);
          brandId = brandIdResult[0].id;
          newBrandsCount++;
        }
        
        brandMap.set(brandName, brandId);

        // Mevcut modelleri kontrol et (bu marka için)
        const existingModels = await queryRunner.query(
          `SELECT name FROM motor_models WHERE brand_id = ?`,
          [brandId]
        );
        const existingModelSet = new Set<string>();
        existingModels.forEach((model: { name: string }) => {
          existingModelSet.add(model.name);
        });

        // Yeni modelleri batch olarak ekle (sadece yoksa)
        const newModels: string[] = [];
        for (const modelName of models as string[]) {
          if (!existingModelSet.has(modelName)) {
            newModels.push(modelName);
          }
        }

        // Batch insert ile modelleri ekle (performans için)
        if (newModels.length > 0) {
          // Her 100 model için bir batch oluştur (MySQL'in max_allowed_packet limiti için)
          const batchSize = 100;
          for (let i = 0; i < newModels.length; i += batchSize) {
            const batch = newModels.slice(i, i + batchSize);
            const values = batch.map(() => '(?, ?, NOW(), NOW())').join(', ');
            const params: any[] = [];
            batch.forEach(modelName => {
              params.push(brandId, modelName);
            });
            
            await queryRunner.query(
              `INSERT INTO motor_models (brand_id, name, created_at, updated_at) VALUES ${values}`,
              params
            );
          }
        }
      }
    }

    // Toplam model sayısını al
    const totalModelsResult = await queryRunner.query(`SELECT COUNT(*) as count FROM motor_models`);
    const totalModels = totalModelsResult[0].count;

    console.log(`Motor markaları ve modelleri başarıyla eklendi.`);
    console.log(`- Yeni eklenen markalar: ${newBrandsCount}`);
    console.log(`- Mevcut markalar: ${existingBrandsCount}`);
    console.log(`- Toplam marka sayısı: ${brandMap.size}`);
    console.log(`- Toplam model sayısı: ${totalModels}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Foreign key'i kaldır
    const table = await queryRunner.getTable('motor_models');
    if (table) {
      const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('brand_id') !== -1);
      if (foreignKey) {
        await queryRunner.dropForeignKey('motor_models', foreignKey);
      }
    }

    // Index'i kaldır
    await queryRunner.dropIndex('motor_models', 'IDX_motor_models_brand_id');

    // Tabloları kaldır
    await queryRunner.dropTable('motor_models');
    await queryRunner.dropTable('motor_brands');
  }
}

