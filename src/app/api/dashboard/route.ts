import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Fetch all active/pending/completed orders
    const orders = await prisma.productOrder.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Fetch all machines
    const machines = await prisma.machine.findMany();

    // Fetch recent logs (limit 20)
    const logs = await prisma.systemLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    // Fetch quality inspections to calculate defect statistics
    const inspections = await prisma.qualityInspection.findMany();

    // Compute metrics
    const activeOrders = orders.filter(o => o.status === 'RUNNING');
    const pendingOrders = orders.filter(o => o.status === 'PENDING');
    const completedOrders = orders.filter(o => o.status === 'COMPLETED');

    // Average machine efficiency (excluding MAINTENANCE and offline machines)
    const runningMachines = machines.filter(m => m.status === 'ACTIVE');
    const avgEfficiency = runningMachines.length > 0 
      ? runningMachines.reduce((sum, m) => sum + m.efficiency, 0) / runningMachines.length
      : 0;

    // Defect rate calculations
    const totalDefects = inspections.reduce((sum, i) => sum + i.defectCount, 0);
    const totalQuantityProduced = orders.reduce((sum, o) => sum + o.quantity, 0);
    const defectRate = totalQuantityProduced > 0 
      ? (totalDefects / (totalQuantityProduced + totalDefects)) * 100 
      : 0;

    // Active alarms count (machines in ERROR, plus logs with severity ERROR/WARNING in last 24h)
    const errorMachines = machines.filter(m => m.status === 'ERROR').length;
    const warningLogs = logs.filter(l => l.severity === 'ERROR' || l.severity === 'WARNING').length;
    const alertCount = errorMachines + warningLogs;

    return NextResponse.json({
      metrics: {
        avgEfficiency: parseFloat(avgEfficiency.toFixed(1)),
        defectRate: parseFloat(defectRate.toFixed(2)),
        activeRuns: activeOrders.length,
        pendingRuns: pendingOrders.length,
        completedRuns: completedOrders.length,
        alertCount,
      },
      machines,
      orders,
      logs,
      inspections,
    });
  } catch (error) {
    console.error('API Error in dashboard:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
