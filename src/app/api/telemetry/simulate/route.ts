import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    const logsCreated: string[] = [];

    // 1. Simulate Machine Telemetry Fluctuations
    const machines = await prisma.machine.findMany();
    if (machines.length > 0) {
      // Pick a random machine
      const randomMachine = machines[Math.floor(Math.random() * machines.length)];
      
      let newEfficiency = randomMachine.efficiency;
      let newTemperature = randomMachine.temperature;
      let newStatus = randomMachine.status;

      if (randomMachine.status !== 'MAINTENANCE') {
        // Temperature fluctuations (-2C to +4C)
        newTemperature = parseFloat((randomMachine.temperature + (Math.random() * 6 - 2)).toFixed(1));
        // Clamp temperature to realistic bounds
        if (newTemperature < 20) newTemperature = 20;
        if (newTemperature > 85) newTemperature = 85;

        // Efficiency fluctuations (-3% to +3%)
        newEfficiency = parseFloat((randomMachine.efficiency + (Math.random() * 6 - 3)).toFixed(1));
        if (newEfficiency < 70) newEfficiency = 70;
        if (newEfficiency > 100) newEfficiency = 100;

        // Rare error state trigger (5% chance)
        if (Math.random() < 0.05 && randomMachine.status === 'ACTIVE') {
          newStatus = 'ERROR';
          newEfficiency = 0.0;
        } else if (randomMachine.status === 'ERROR' && Math.random() < 0.40) {
          // 40% chance error resolves to ACTIVE
          newStatus = 'ACTIVE';
          newEfficiency = 85.0;
        }
      } else {
        // Machine in maintenance: 30% chance maintenance completes
        if (Math.random() < 0.3) {
          newStatus = 'ACTIVE';
          newEfficiency = 95.0;
          newTemperature = 25.0;
        }
      }

      await prisma.machine.update({
        where: { id: randomMachine.id },
        data: {
          efficiency: newEfficiency,
          temperature: newTemperature,
          status: newStatus,
        },
      });

      // Log machine changes
      if (newStatus === 'ERROR' && randomMachine.status !== 'ERROR') {
        const msg = `CRITICAL: ${randomMachine.name} entered ERROR state. Temperature: ${newTemperature}°C.`;
        await prisma.systemLog.create({
          data: {
            action: 'MACHINE_ERROR',
            details: msg,
            severity: 'ERROR',
          },
        });
        logsCreated.push(msg);
      } else if (newStatus === 'ACTIVE' && randomMachine.status === 'ERROR') {
        const msg = `${randomMachine.name} error cleared. Returning to service.`;
        await prisma.systemLog.create({
          data: {
            action: 'MACHINE_RESTORE',
            details: msg,
            severity: 'INFO',
          },
        });
        logsCreated.push(msg);
      } else if (newTemperature > 75) {
        const msg = `WARNING: ${randomMachine.name} temperature high (${newTemperature}°C).`;
        await prisma.systemLog.create({
          data: {
            action: 'MACHINE_ALERT',
            details: msg,
            severity: 'WARNING',
          },
        });
        logsCreated.push(msg);
      }
    }

    // 2. Progress Running Production Orders
    const activeOrders = await prisma.productOrder.findMany({
      where: { status: 'RUNNING' },
    });

    for (const order of activeOrders) {
      // Produce between 10 and 25 units
      const produced = Math.floor(Math.random() * 16) + 10;
      const newQuantity = Math.min(order.quantity + produced, order.targetQuantity);
      const isCompleted = newQuantity >= order.targetQuantity;

      if (isCompleted) {
        // Complete the order
        await prisma.productOrder.update({
          where: { id: order.id },
          data: {
            quantity: newQuantity,
            status: 'COMPLETED',
            endDate: new Date(),
          },
        });

        // Add a quality inspection pending review
        const randomDefects = Math.floor(Math.random() * 6); // 0-5 defects
        await prisma.qualityInspection.create({
          data: {
            orderId: order.id,
            inspectorName: 'AI Optical Scanner',
            status: 'PENDING',
            defectCount: randomDefects,
            notes: `Auto-scan complete. ${randomDefects} anomaly flags found. Awaiting final quality engineer review.`,
          },
        });

        const msgComplete = `Order '${order.name}' has COMPLETED production. Quality review initiated.`;
        await prisma.systemLog.create({
          data: {
            action: 'ORDER_COMPLETE',
            details: msgComplete,
            severity: 'INFO',
            orderId: order.id,
          },
        });
        logsCreated.push(msgComplete);
      } else {
        // Update progress
        await prisma.productOrder.update({
          where: { id: order.id },
          data: { quantity: newQuantity },
        });

        // Occasional progress logs (20% chance)
        if (Math.random() < 0.2) {
          const msgProgress = `Order '${order.name}' progress: ${newQuantity}/${order.targetQuantity} units.`;
          await prisma.systemLog.create({
            data: {
              action: 'ORDER_PROGRESS',
              details: msgProgress,
              severity: 'INFO',
              orderId: order.id,
            },
          });
          logsCreated.push(msgProgress);
        }
      }
    }

    // 3. Keep machines running: If there's a PENDING order and no RUNNING order, start the next one
    const runningCount = await prisma.productOrder.count({
      where: { status: 'RUNNING' },
    });

    if (runningCount === 0) {
      const nextPending = await prisma.productOrder.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      });

      if (nextPending) {
        await prisma.productOrder.update({
          where: { id: nextPending.id },
          data: {
            status: 'RUNNING',
            startDate: new Date(),
          },
        });

        const msgStart = `Started production run for pending order '${nextPending.name}'.`;
        await prisma.systemLog.create({
          data: {
            action: 'ORDER_START',
            details: msgStart,
            severity: 'INFO',
            orderId: nextPending.id,
          },
        });
        logsCreated.push(msgStart);
      }
    }

    return NextResponse.json({
      success: true,
      logs: logsCreated,
    });
  } catch (error) {
    console.error('Telemetry simulation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
