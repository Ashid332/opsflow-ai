import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

async function withTimeout<T>(promise: Promise<T>, ms: number = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database query timed out')), ms)
    )
  ]);
}

export async function GET() {
  try {
    console.log('[DASHBOARD-API] Querying database with 5s timeout protection...');
    const orders = await withTimeout(prisma.productOrder.findMany({
      orderBy: { createdAt: 'desc' },
    }));

    const inspections = await withTimeout(prisma.qualityInspection.findMany({
      include: { order: true },
    }));

    const logs = await withTimeout(prisma.systemLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 20,
    }));

    const machines = await withTimeout(prisma.machine.findMany());
    console.log('[DASHBOARD-API] Database queries completed successfully');

    // 1. Core Analytics Metrics
    const totalUploads = orders.length;
    
    // Validation failures = Suspended orders (due to blockers) + Rejected reviews
    const validationFailures = orders.filter(o => o.status === 'SUSPENDED').length + 
                               inspections.filter(i => i.status === 'REJECTED').length;

    // Calculate average OCR confidence across all processed documents
    let totalConfidence = 0;
    let confidenceCount = 0;
    
    // 2. Aggregate groups (Shifts, Machines, Quantities)
    const shiftData: Record<string, number> = {
      'Morning Shift': 0,
      'Afternoon Shift': 0,
      'Night Shift': 0
    };
    
    const machineData: Record<string, number> = {};
    // Seed machine targets
    machines.forEach(m => {
      machineData[m.name] = 0;
    });

    const quantityHistory: any[] = [];

    // Parse inspections metadata
    inspections.forEach(ins => {
      try {
        if (ins.notes) {
          const meta = JSON.parse(ins.notes);
          
          // Accumulate average confidence
          if (meta.confidence) {
            const confs = Object.values(meta.confidence) as number[];
            const avgConf = confs.reduce((s, c) => s + c, 0) / confs.length;
            totalConfidence += avgConf;
            confidenceCount++;
          }

          // Accumulate shift summaries
          const shift = meta.shift || 'Morning Shift';
          if (shiftData[shift] !== undefined) {
            shiftData[shift] += ins.order.targetQuantity;
          } else {
            shiftData[shift] = ins.order.targetQuantity;
          }

          // Accumulate machine summaries
          const machName = meta.machineName || 'Assembly Line A (CNC)';
          if (machineData[machName] !== undefined) {
            machineData[machName] += ins.order.targetQuantity;
          } else {
            machineData[machName] = ins.order.targetQuantity;
          }
        }
      } catch (e) {
        // Skip parsing errors
      }
    });

    // Format shift summaries for Recharts
    const shiftSummary = Object.keys(shiftData).map(name => ({
      name,
      Quantity: shiftData[name]
    }));

    // Format machine summaries for Recharts
    const machineSummary = Object.keys(machineData).map(name => ({
      name: name.replace(/ \(.+\)/, '').replace(' Station', '').replace(' Robot', '').replace(' Scanner', ''),
      Quantity: machineData[name]
    }));

    // Build quantity summaries for Area chart (Target vs Produced)
    // Map last 8 orders
    const recentOrders = [...orders].reverse().slice(-8);
    const quantitySummary = recentOrders.map(o => ({
      name: o.name.split('#')[1] ? `#${o.name.split('#')[1]}` : o.name.substring(0, 10),
      Target: o.targetQuantity,
      Produced: o.quantity
    }));

    const avgConfidencePct = confidenceCount > 0 
      ? Math.round((totalConfidence / confidenceCount) * 100)
      : 88; // fallback default

    return NextResponse.json({
      metrics: {
        totalUploads,
        validationFailures,
        avgConfidence: avgConfidencePct,
        alerts: validationFailures + logs.filter(l => l.severity === 'ERROR').length,
      },
      shiftSummary,
      machineSummary,
      quantitySummary,
      logs,
      orders
    });
  } catch (error) {
    console.error('API Error in refactored dashboard:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
