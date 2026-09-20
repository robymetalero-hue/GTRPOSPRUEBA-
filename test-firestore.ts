import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    const results: any = { cash_accounts: [], cash_movements: [], sales: [] };

    const qAcc = query(collection(db, 'cash_accounts'), where('seller_id', '==', 3));
    const snapAcc = await getDocs(qAcc);
    snapAcc.forEach(doc => {
      results.cash_accounts.push({ id: doc.id, ...doc.data() });
    });

    const qMov = query(collection(db, 'cash_movements'), where('seller_id', '==', 3));
    const snapMov = await getDocs(qMov);
    snapMov.forEach(doc => {
      results.cash_movements.push({ id: doc.id, ...doc.data() });
    });

    const qSales = query(collection(db, 'sales'), where('user_id', '==', 3));
    const snapSales = await getDocs(qSales);
    snapSales.forEach(doc => {
      const data: any = doc.data();
      if ([33, 34, 35, 36].includes(data.id)) {
        results.sales.push({ id: doc.id, ...data });
      }
    });

    fs.writeFileSync('./firestore-result.json', JSON.stringify(results, null, 2), 'utf8');
    console.log('Results written successfully!');
    process.exit(0);
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}
run();
