import fs from 'fs';
import path from 'path';

/**
 * Generates sample CSV files for ingestion testing during hackathon demo.
 */
function generateTestBatch(filename: string, rowCount: number = 20): void {
  const outputDir = path.join(__dirname, '../data/sample-files');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, filename);
  const currencies = ['USD', 'EUR', 'INR', 'GBP', 'JPY', 'INVALID_CCY'];
  const ifscCodes = ['SBIN0001234', 'HDFC0000456', 'ICIC0000789', 'KKBK0000321', 'BADIFSC999'];

  const rows: string[] = ['transaction_id,account_number,ifsc_code,currency,amount,timestamp'];

  for (let i = 1; i <= rowCount; i++) {
    const txnId = `TXN_${Date.now()}_${i}`;
    const acc = i % 7 === 0 ? `INVALID_ACC_${i}` : `ACC10000${(i % 5) + 1}`;
    const ifsc = ifscCodes[i % ifscCodes.length];
    const ccy = currencies[i % currencies.length];
    const amount = (Math.random() * 50000 + 100).toFixed(2);
    const ts = new Date().toISOString();

    rows.push(`${txnId},${acc},${ifsc},${ccy},${amount},${ts}`);
  }

  fs.writeFileSync(filePath, rows.join('\n'), 'utf-8');
  console.log(`[generateTestFiles] Generated test file with ${rowCount} rows at: ${filePath}`);
}

const targetName = process.argv[2] || `batch_${Date.now()}.csv`;
const count = parseInt(process.argv[3] || '25', 10);
generateTestBatch(targetName, count);
