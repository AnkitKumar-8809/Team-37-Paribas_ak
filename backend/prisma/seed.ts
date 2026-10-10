import { PrismaClient, FileStatus, ResolutionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[seed] Seeding starter hackathon data...');

  const sampleFile = await prisma.fileRecord.create({
    data: {
      filename: 'sample_transactions_001.csv',
      originalName: 'transactions_october.csv',
      status: FileStatus.PROCESSING,
      progress: 68.5,
      totalRows: 500,
      processedRows: 342,
      errorCount: 3,
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      rejections: {
        create: [
          {
            rowNumber: 42,
            rawData: 'TXN9004,INVALID_ACC,KKBK0000321,INR,1200.00,2026-10-10T10:00:15Z',
            reason: 'Account number INVALID_ACC does not exist in master records',
            status: ResolutionStatus.PENDING
          },
          {
            rowNumber: 108,
            rawData: 'TXN9005,ACC100004,WRONG_IFSC,GBP,53000.00,2026-10-10T10:00:20Z',
            reason: 'Invalid IFSC format: WRONG_IFSC',
            status: ResolutionStatus.PENDING
          }
        ]
      },
      anomalies: {
        create: [
          {
            anomalyType: 'HIGH_VALUE_DEVIATION',
            score: 0.94,
            details: 'Row 88 amount $450,000 exceeds 3-sigma historical mean ($12,400)',
            status: 'OPEN'
          }
        ]
      }
    }
  });

  console.log(`[seed] Created starter file record: ${sampleFile.id}`);
  console.log('[seed] Seeding completed.');
}

main()
  .catch((e) => {
    console.error('[seed] Error while seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
