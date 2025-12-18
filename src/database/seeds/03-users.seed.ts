import { AppDataSource } from '../../config/database';
import { User } from '../../entities/User';
import { Agency } from '../../entities/Agency';
import { Branch } from '../../entities/Branch';
import { hashPassword } from '../../utils/hash';
import { UserRole, EntityStatus } from '../../types/enums';

export const seedUsers = async () => {
  const userRepository = AppDataSource.getRepository(User);
  const agencyRepository = AppDataSource.getRepository(Agency);
  const branchRepository = AppDataSource.getRepository(Branch);

  // Create Super Admin
  const superAdminEmail = 'admin@yolasistan.com';
  let superAdmin = await userRepository.findOne({
    where: { email: superAdminEmail },
  });

  if (!superAdmin) {
    const hashedPassword = await hashPassword('Admin123!');
    superAdmin = userRepository.create({
      name: 'Sistem Yöneticisi',
      email: superAdminEmail,
      phone: '0532 111 1111',
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
      status: EntityStatus.ACTIVE,
    });
    await userRepository.save(superAdmin);
    console.log(`✓ Super Admin created: ${superAdminEmail}`);
  } else {
    console.log(`- Super Admin exists: ${superAdminEmail}`);
  }

  const agencies = await agencyRepository.find();
  const branches = await branchRepository.find({ relations: ['agency'] });

  const createdUsers = [superAdmin];

  // Agency Admins
  const agencyAdmins = [
    { name: 'Ahmet Yılmaz', email: 'ahmet.yilmaz@anadolu.com', phone: '0532 222 2222' },
    { name: 'Mehmet Demir', email: 'mehmet.demir@guven.com', phone: '0533 333 3333' },
    { name: 'Ali Kaya', email: 'ali.kaya@akdeniz.com', phone: '0534 444 4444' },
    { name: 'Mustafa Şahin', email: 'mustafa.sahin@marmara.com', phone: '0535 555 5555' },
    { name: 'Hüseyin Çelik', email: 'huseyin.celik@ege.com', phone: '0536 666 6666' },
  ];

  for (let i = 0; i < agencies.length && i < agencyAdmins.length; i++) {
    const adminData = agencyAdmins[i];
    const agency = agencies[i];

    const existing = await userRepository.findOne({
      where: { email: adminData.email },
    });

    if (!existing) {
      const hashedPassword = await hashPassword('Admin123!');
      const user = userRepository.create({
        ...adminData,
        password: hashedPassword,
        role: UserRole.AGENCY_ADMIN,
        agency_id: agency.id,
        status: EntityStatus.ACTIVE,
      });
      const saved = await userRepository.save(user);
      createdUsers.push(saved);
      console.log(`✓ Agency Admin created: ${adminData.email}`);
    } else {
      createdUsers.push(existing);
      console.log(`- Agency Admin exists: ${adminData.email}`);
    }
  }

  // Branch Admins
  const branchAdmins = [
    { name: 'Fatma Öztürk', email: 'fatma.ozturk@anadolu.com', phone: '0537 111 2222' },
    { name: 'Ayşe Arslan', email: 'ayse.arslan@anadolu.com', phone: '0537 222 3333' },
    { name: 'Zeynep Yıldız', email: 'zeynep.yildiz@guven.com', phone: '0538 333 4444' },
    { name: 'Elif Kurt', email: 'elif.kurt@guven.com', phone: '0538 444 5555' },
    { name: 'Merve Aydın', email: 'merve.aydin@akdeniz.com', phone: '0539 555 6666' },
    { name: 'Hatice Özkan', email: 'hatice.ozkan@akdeniz.com', phone: '0539 666 7777' },
    { name: 'Hacer Şen', email: 'hacer.sen@marmara.com', phone: '0532 777 8888' },
    { name: 'Seda Koç', email: 'seda.koc@marmara.com', phone: '0532 888 9999' },
    { name: 'Büşra Aksoy', email: 'busra.aksoy@ege.com', phone: '0533 999 1111' },
    { name: 'Nur Yavuz', email: 'nur.yavuz@ege.com', phone: '0533 111 2222' },
  ];

  for (let i = 0; i < branches.length && i < branchAdmins.length; i++) {
    const adminData = branchAdmins[i];
    const branch = branches[i];

    const existing = await userRepository.findOne({
      where: { email: adminData.email },
    });

    if (!existing) {
      const hashedPassword = await hashPassword('Admin123!');
      const user = userRepository.create({
        ...adminData,
        password: hashedPassword,
        role: UserRole.BRANCH_ADMIN,
        agency_id: branch.agency_id,
        branch_id: branch.id,
        status: EntityStatus.ACTIVE,
      });
      const saved = await userRepository.save(user);
      createdUsers.push(saved);
      console.log(`✓ Branch Admin created: ${adminData.email}`);
    } else {
      createdUsers.push(existing);
      console.log(`- Branch Admin exists: ${adminData.email}`);
    }
  }

  // Branch Users (2 per branch)
  const branchUsers = [
    { name: 'Can Yılmaz', email: 'can.yilmaz@anadolu.com', phone: '0540 111 2222' },
    { name: 'Cem Demir', email: 'cem.demir@anadolu.com', phone: '0540 222 3333' },
    { name: 'Deniz Kaya', email: 'deniz.kaya@anadolu.com', phone: '0541 333 4444' },
    { name: 'Emre Şahin', email: 'emre.sahin@anadolu.com', phone: '0541 444 5555' },
    { name: 'Furkan Çelik', email: 'furkan.celik@guven.com', phone: '0542 555 6666' },
    { name: 'Gökhan Öztürk', email: 'gokhan.ozturk@guven.com', phone: '0542 666 7777' },
    { name: 'Hakan Arslan', email: 'hakan.arslan@guven.com', phone: '0543 777 8888' },
    { name: 'İbrahim Yıldız', email: 'ibrahim.yildiz@guven.com', phone: '0543 888 9999' },
    { name: 'Kemal Kurt', email: 'kemal.kurt@akdeniz.com', phone: '0544 999 1111' },
    { name: 'Levent Aydın', email: 'levent.aydin@akdeniz.com', phone: '0544 111 2222' },
    { name: 'Murat Özkan', email: 'murat.ozkan@akdeniz.com', phone: '0545 222 3333' },
    { name: 'Oğuz Şen', email: 'oguz.sen@akdeniz.com', phone: '0545 333 4444' },
    { name: 'Serkan Koç', email: 'serkan.koc@marmara.com', phone: '0546 444 5555' },
    { name: 'Tolga Aksoy', email: 'tolga.aksoy@marmara.com', phone: '0546 555 6666' },
    { name: 'Uğur Yavuz', email: 'ugur.yavuz@marmara.com', phone: '0547 666 7777' },
    { name: 'Volkan Aslan', email: 'volkan.aslan@marmara.com', phone: '0547 777 8888' },
    { name: 'Yusuf Tekin', email: 'yusuf.tekin@ege.com', phone: '0548 888 9999' },
    { name: 'Zafer Polat', email: 'zafer.polat@ege.com', phone: '0548 999 1111' },
    { name: 'Barış Güneş', email: 'baris.gunes@ege.com', phone: '0549 111 2222' },
    { name: 'Cengiz Acar', email: 'cengiz.acar@ege.com', phone: '0549 222 3333' },
  ];

  for (let i = 0; i < branches.length && i * 2 < branchUsers.length; i++) {
    const branch = branches[i];

    for (let j = 0; j < 2 && i * 2 + j < branchUsers.length; j++) {
      const userData = branchUsers[i * 2 + j];

      const existing = await userRepository.findOne({
        where: { email: userData.email },
      });

      if (!existing) {
        const hashedPassword = await hashPassword('User123!');
        const user = userRepository.create({
          ...userData,
          password: hashedPassword,
          role: UserRole.BRANCH_USER,
          agency_id: branch.agency_id,
          branch_id: branch.id,
          status: EntityStatus.ACTIVE,
        });
        const saved = await userRepository.save(user);
        createdUsers.push(saved);
        console.log(`✓ Branch User created: ${userData.email}`);
      } else {
        createdUsers.push(existing);
        console.log(`- Branch User exists: ${userData.email}`);
      }
    }
  }

  return createdUsers;
};
