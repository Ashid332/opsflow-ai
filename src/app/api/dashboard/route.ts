import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

async function withTimeout<T>(promise: Promise<T>, ms: number = 15000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database query timed out')), ms)
    )
  ]);
}

export async function GET() {
  try {
    console.log('[DASHBOARD-API] Querying database in parallel with 15s timeout protection...');
    
    const [orders, inspections, logs, machines] = await withTimeout(
      Promise.all([
        prisma.productOrder.findMany({
          orderBy: { createdAt: 'desc' },
        }),
        prisma.qualityInspection.findMany({
          include: { order: true },
        }),
        prisma.systemLog.findMany({
          orderBy: { timestamp: 'desc' },
          take: 20,
        }),
        prisma.machine.findMany(),
      ]),
      15000
    );

    console.log('[DASHBOARD-API] Database queries completed successfully');

    // 1. Core Analytics Metrics safely guarded
    const totalUploads = orders ? orders.length : 0;
    
    // Validation failures = Suspended orders (due to blockers) + Rejected reviews
    const validationFailures = (orders ? orders.filter(o => o.status === 'SUSPENDED').length : 0) + 
                               (inspections ? inspections.filter(i => i.status === 'REJECTED').length : 0);

    // Calculate average OCR confidence across all processed documents safely
    let totalConfidence = 0;
    let confidenceCount = 0;
    
    // 2. Aggregate groups (Shifts, Machines, Quantities)
    const shiftData: Record<string, number> = {
      'Morning Shift': 0,
      'Afternoon Shift': 0,
      'Night Shift': 0
    };
    
    const machineData: Record<string, number> = {};
    // Seed machine targets safely
    if (machines && Array.isArray(machines)) {
      machines.forEach(m => {
        if (m.name) {
          machineData[m.name] = 0;
        }
      });
    }

    // Parse inspections metadata
    if (inspections && Array.isArray(inspections)) {
      inspections.forEach(ins => {
        try {
          if (ins.notes) {
            const meta = JSON.parse(ins.notes);
            
            // Accumulate average confidence safely, guarding against NaN & empty confidence maps
            if (meta.confidence && typeof meta.confidence === 'object') {
              const confs = (Object.values(meta.confidence) as number[]).filter(
                v => typeof v === 'number' && !isNaN(v)
              );
              if (confs.length > 0) {
                const avgConf = confs.reduce((s, c) => s + c, 0) / confs.length;
                totalConfidence += avgConf;
                confidenceCount++;
              }
            }

            // Accumulate shift summaries safely (using ins.order relation check)
            const shift = meta.shift || 'Morning Shift';
            const targetQty = ins.order?.targetQuantity ?? 0;
            if (shiftData[shift] !== undefined) {
              shiftData[shift] += targetQty;
            } else {
              shiftData[shift] = targetQty;
            }

            // Accumulate machine summaries safely
            const machName = meta.machineName || 'Assembly Line A (CNC)';
            if (machineData[machName] !== undefined) {
              machineData[machName] += targetQty;
            } else {
              machineData[machName] = targetQty;
            }
          }
        } catch (e) {
          // Skip parsing errors
        }
      });
    }

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
    // Map last 8 orders safely
    const recentOrders = orders && Array.isArray(orders) ? [...orders].reverse().slice(-8) : [];
    const quantitySummary = recentOrders.map(o => ({
      name: o.name?.split('#')[1] ? `#${o.name.split('#')[1]}` : (o.name ? o.name.substring(0, 10) : 'Unknown'),
      Target: o.targetQuantity ?? 0,
      Produced: o.quantity ?? 0
    }));

    const avgConfidencePct = confidenceCount > 0 
      ? Math.round((totalConfidence / confidenceCount) * 100)
      : 88; // fallback default if no confidences extracted yet

    const activeLogs = logs ? logs : [];

    return NextResponse.json({
      metrics: {
        totalUploads,
        validationFailures,
        avgConfidence: avgConfidencePct,
        alerts: validationFailures + activeLogs.filter(l => l.severity === 'ERROR').length,
      },
      shiftSummary,
      machineSummary,
      quantitySummary,
      logs: activeLogs,
      orders: orders || []
    });
  } catch (error) {
    console.error('API Error in parallel dashboard route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
