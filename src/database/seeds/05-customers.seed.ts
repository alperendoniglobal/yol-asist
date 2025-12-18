import { AppDataSource } from '../../config/database';
import { Customer } from '../../entities/Customer';
import { User } from '../../entities/User';
import { UserRole } from '../../types/enums';

export const seedCustomers = async () => {
  const customerRepository = AppDataSource.getRepository(Customer);
  const userRepository = AppDataSource.getRepository(User);

  // Get BRANCH_USER users
  const branchUsers = await userRepository.find({
    where: { role: UserRole.BRANCH_USER },
    relations: ['agency', 'branch'],
  });

  if (branchUsers.length === 0) {
    console.log('⚠ No branch users found. Please seed users first.');
    return [];
  }

  const customersData = [
    { name: 'Ahmet', surname: 'Yılmaz', tc_vkn: '12345678901', phone: '0532 123 4567', email: 'ahmet.yilmaz@email.com', address: 'Kadıköy, İstanbul' },
    { name: 'Mehmet', surname: 'Kaya', tc_vkn: '23456789012', phone: '0533 234 5678', email: 'mehmet.kaya@email.com', address: 'Beşiktaş, İstanbul' },
    { name: 'Ayşe', surname: 'Demir', tc_vkn: '34567890123', phone: '0534 345 6789', email: 'ayse.demir@email.com', address: 'Çankaya, Ankara' },
    { name: 'Fatma', surname: 'Şahin', tc_vkn: '45678901234', phone: '0535 456 7890', email: 'fatma.sahin@email.com', address: 'Keçiören, Ankara' },
    { name: 'Ali', surname: 'Çelik', tc_vkn: '56789012345', phone: '0536 567 8901', email: 'ali.celik@email.com', address: 'Muratpaşa, Antalya' },
    { name: 'Zeynep', surname: 'Öztürk', tc_vkn: '67890123456', phone: '0537 678 9012', email: 'zeynep.ozturk@email.com', address: 'Kepez, Antalya' },
    { name: 'Mustafa', surname: 'Arslan', tc_vkn: '78901234567', phone: '0538 789 0123', email: 'mustafa.arslan@email.com', address: 'Konak, İzmir' },
    { name: 'Emine', surname: 'Yıldız', tc_vkn: '89012345678', phone: '0539 890 1234', email: 'emine.yildiz@email.com', address: 'Karşıyaka, İzmir' },
    { name: 'Can', surname: 'Kurt', tc_vkn: '90123456789', phone: '0532 901 2345', email: 'can.kurt@email.com', address: 'Nilüfer, Bursa' },
    { name: 'Elif', surname: 'Aydın', tc_vkn: '01234567890', phone: '0533 012 3456', email: 'elif.aydin@email.com', address: 'Osmangazi, Bursa' },
    { name: 'Hüseyin', surname: 'Özkan', tc_vkn: '11234567890', phone: '0534 112 3456', email: 'huseyin.ozkan@email.com', address: 'Kadıköy, İstanbul' },
    { name: 'Hatice', surname: 'Şen', tc_vkn: '21234567890', phone: '0535 212 3456', email: 'hatice.sen@email.com', address: 'Beşiktaş, İstanbul' },
    { name: 'İbrahim', surname: 'Koç', tc_vkn: '31234567890', phone: '0536 312 3456', email: 'ibrahim.koc@email.com', address: 'Çankaya, Ankara' },
    { name: 'Meryem', surname: 'Aksoy', tc_vkn: '41234567890', phone: '0537 412 3456', email: 'meryem.aksoy@email.com', address: 'Keçiören, Ankara' },
    { name: 'Hasan', surname: 'Yavuz', tc_vkn: '51234567890', phone: '0538 512 3456', email: 'hasan.yavuz@email.com', address: 'Muratpaşa, Antalya' },
    { name: 'Büşra', surname: 'Aslan', tc_vkn: '61234567890', phone: '0539 612 3456', email: 'busra.aslan@email.com', address: 'Kepez, Antalya' },
    { name: 'Ömer', surname: 'Tekin', tc_vkn: '71234567890', phone: '0532 712 3456', email: 'omer.tekin@email.com', address: 'Konak, İzmir' },
    { name: 'Seda', surname: 'Polat', tc_vkn: '81234567890', phone: '0533 812 3456', email: 'seda.polat@email.com', address: 'Karşıyaka, İzmir' },
    { name: 'Kemal', surname: 'Güneş', tc_vkn: '91234567890', phone: '0534 912 3456', email: 'kemal.gunes@email.com', address: 'Nilüfer, Bursa' },
    { name: 'Nur', surname: 'Acar', tc_vkn: '10234567890', phone: '0535 102 3456', email: 'nur.acar@email.com', address: 'Osmangazi, Bursa' },
    { name: 'Emre', surname: 'Erdoğan', tc_vkn: '20234567890', phone: '0536 202 3456', email: 'emre.erdogan@email.com', address: 'Kadıköy, İstanbul' },
    { name: 'Merve', surname: 'Yalçın', tc_vkn: '30234567890', phone: '0537 302 3456', email: 'merve.yalcin@email.com', address: 'Beşiktaş, İstanbul' },
    { name: 'Burak', surname: 'Kılıç', tc_vkn: '40234567890', phone: '0538 402 3456', email: 'burak.kilic@email.com', address: 'Çankaya, Ankara' },
    { name: 'Gamze', surname: 'Duman', tc_vkn: '50234567890', phone: '0539 502 3456', email: 'gamze.duman@email.com', address: 'Keçiören, Ankara' },
    { name: 'Serkan', surname: 'Kaplan', tc_vkn: '60234567890', phone: '0532 602 3456', email: 'serkan.kaplan@email.com', address: 'Muratpaşa, Antalya' },
    { name: 'Gizem', surname: 'Çakır', tc_vkn: '70234567890', phone: '0533 702 3456', email: 'gizem.cakir@email.com', address: 'Kepez, Antalya' },
    { name: 'Volkan', surname: 'Yıldırım', tc_vkn: '80234567890', phone: '0534 802 3456', email: 'volkan.yildirim@email.com', address: 'Konak, İzmir' },
    { name: 'Deniz', surname: 'Tunç', tc_vkn: '90234567890', phone: '0535 902 3456', email: 'deniz.tunc@email.com', address: 'Karşıyaka, İzmir' },
    { name: 'Barış', surname: 'Uzun', tc_vkn: '11334567890', phone: '0536 113 3456', email: 'baris.uzun@email.com', address: 'Nilüfer, Bursa' },
    { name: 'Canan', surname: 'Bulut', tc_vkn: '22334567890', phone: '0537 223 3456', email: 'canan.bulut@email.com', address: 'Osmangazi, Bursa' },
  ];

  const createdCustomers = [];
  let userIndex = 0;

  for (const customerData of customersData) {
    const user = branchUsers[userIndex % branchUsers.length];

    const existing = await customerRepository.findOne({
      where: { tc_vkn: customerData.tc_vkn },
    });

    if (!existing) {
      const customer = customerRepository.create({
        ...customerData,
        agency_id: user.agency_id!,
        branch_id: user.branch_id!,
        created_by: user.id,
      });
      const saved = await customerRepository.save(customer);
      createdCustomers.push(saved);
      console.log(`✓ Customer created: ${customerData.name} ${customerData.surname}`);
    } else {
      createdCustomers.push(existing);
      console.log(`- Customer exists: ${customerData.name} ${customerData.surname}`);
    }

    userIndex++;
  }

  return createdCustomers;
};
