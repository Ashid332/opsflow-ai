import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Set WebSocket constructor for local Node.js environment
if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

function getPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.includes('placeholder')) {
    throw new Error('DATABASE_URL is not set. Please configure it in your .env file.');
  }
  console.log(`Connecting to: ${connectionString.substring(0, 40)}...`);
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

async function main() {
  const prisma = getPrismaClient();

  console.log('Clearing database...');
  await prisma.systemLog.deleteMany({});
  await prisma.qualityInspection.deleteMany({});
  await prisma.productOrder.deleteMany({});
  await prisma.machine.deleteMany({});

  console.log('Seeding machines...');
  const machines = await Promise.all([
    prisma.machine.create({
      data: {
        name: 'Assembly Line A (CNC)',
        status: 'ACTIVE',
        efficiency: 94.5,
        temperature: 42.1,
        uptime: 98.2,
        lastMaintenance: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.machine.create({
      data: {
        name: 'Welding Robot B',
        status: 'ACTIVE',
        efficiency: 88.2,
        temperature: 68.4,
        uptime: 95.1,
        lastMaintenance: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.machine.create({
      data: {
        name: 'Paint Booth C',
        status: 'MAINTENANCE',
        efficiency: 0.0,
        temperature: 21.3,
        uptime: 91.4,
        lastMaintenance: new Date(),
      },
    }),
    prisma.machine.create({
      data: {
        name: 'Packaging Station D',
        status: 'ACTIVE',
        efficiency: 96.8,
        temperature: 31.5,
        uptime: 99.5,
        lastMaintenance: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.machine.create({
      data: {
        name: 'Quality Inspection Scanner E',
        status: 'IDLE',
        efficiency: 92.1,
        temperature: 26.8,
        uptime: 97.4,
        lastMaintenance: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  console.log('Seeding product orders...');
  const orders = await Promise.all([
    prisma.productOrder.create({
      data: {
        name: 'Auto-Chassis Batch #4102',
        status: 'RUNNING',
        quantity: 342,
        targetQuantity: 500,
        startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.productOrder.create({
      data: {
        name: 'Gearbox Housing Set #883',
        status: 'COMPLETED',
        quantity: 120,
        targetQuantity: 120,
        startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.productOrder.create({
      data: {
        name: 'Electric Motor Casing #215',
        status: 'RUNNING',
        quantity: 85,
        targetQuantity: 250,
        startDate: new Date(Date.now() - 8 * 60 * 60 * 1000),
      },
    }),
    prisma.productOrder.create({
      data: {
        name: 'Sub-Frame Assembly #94',
        status: 'SUSPENDED',
        quantity: 45,
        targetQuantity: 150,
        startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.productOrder.create({
      data: {
        name: 'Bracket Connectors Batch #304',
        status: 'PENDING',
        quantity: 0,
        targetQuantity: 1000,
      },
    }),
  ]);

  console.log('Seeding quality inspections...');
  await prisma.qualityInspection.create({
    data: {
      orderId: orders[1].id,
      inspectorName: 'Chief Inspector Sarah',
      status: 'APPROVED',
      defectCount: 2,
      notes: 'Excellent tolerances. Minor surface finish variance on 2 units, well within threshold.',
    },
  });

  await prisma.qualityInspection.create({
    data: {
      orderId: orders[3].id,
      inspectorName: 'Inspector Dave',
      status: 'REJECTED',
      defectCount: 14,
      notes: 'Critical weld fractures detected in 14 units. Production halted for machine recalibration.',
    },
  });

  await prisma.qualityInspection.create({
    data: {
      orderId: orders[0].id,
      inspectorName: 'Automated AI Inspector',
      status: 'PENDING',
      defectCount: 4,
      notes: 'Initial run checks. 4 cosmetic surface scratches noted. Ongoing evaluation.',
    },
  });

  console.log('Seeding system logs...');
  await prisma.systemLog.createMany({
    data: [
      {
        action: 'ORDER_START',
        details: 'Product order Auto-Chassis Batch #4102 initialized.',
        severity: 'INFO',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        action: 'MACHINE_ALERT',
        details: 'Welding Robot B temperature exceeded warning threshold (68.4C).',
        severity: 'WARNING',
        timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000),
      },
      {
        action: 'ORDER_COMPLETE',
        details: 'Product order Gearbox Housing Set #883 completed (120/120 units).',
        severity: 'INFO',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        action: 'INSPECTION_APPROVE',
        details: 'Quality inspection for Gearbox Housing Set #883 APPROVED by Chief Inspector Sarah.',
        severity: 'INFO',
        timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000),
      },
      {
        action: 'MACHINE_MAINTENANCE',
        details: 'Paint Booth C placed offline for schedule filter replacement.',
        severity: 'INFO',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      },
      {
        action: 'INSPECTION_REJECT',
        details: 'Quality inspection for Sub-Frame Assembly #94 REJECTED by Inspector Dave due to weld fractures.',
        severity: 'ERROR',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
      {
        action: 'ORDER_HALT',
        details: 'Product order Sub-Frame Assembly #94 suspended due to failed inspection.',
        severity: 'ERROR',
        timestamp: new Date(Date.now() - 11 * 60 * 60 * 1000),
      },
    ],
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  });
