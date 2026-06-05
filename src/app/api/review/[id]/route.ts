import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, inspectorName, orderName, targetQuantity, machineName, shiftName, comments } = body;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid review status' }, { status: 400 });
    }

    const inspection = await prisma.qualityInspection.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!inspection) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
    }

    let currentMeta = {
      fileName: 'document.pdf',
      originalText: '',
      shift: shiftName || 'Morning Shift',
      machineName: machineName || 'Assembly Line A (CNC)',
      confidence: { name: 1.0, targetQuantity: 1.0, machineName: 1.0, shift: 1.0 },
      validationErrors: [] as string[],
    };

    try {
      if (inspection.notes) {
        const parsed = JSON.parse(inspection.notes);
        currentMeta = { ...currentMeta, ...parsed };
      }
    } catch (e) {
      // Use fallback metadata
    }

    // Update metadata with corrected values
    currentMeta.shift = shiftName || currentMeta.shift;
    currentMeta.machineName = machineName || currentMeta.machineName;

    // Human edits set confidence score for edited fields to 1.0
    if (orderName) currentMeta.confidence.name = 1.0;
    if (targetQuantity) currentMeta.confidence.targetQuantity = 1.0;
    currentMeta.confidence.machineName = 1.0;
    currentMeta.confidence.shift = 1.0;

    // Re-run validation rules on the newly corrected fields
    const validationErrors: string[] = [];
    const parsedQty = targetQuantity !== undefined ? parseInt(targetQuantity, 10) : inspection.order.targetQuantity;
    const finalMachineName = machineName || currentMeta.machineName;
    const finalOrderName = orderName || inspection.order.name;

    if (parsedQty > 1000) {
      validationErrors.push(`Blocker: Target quantity (${parsedQty}) exceeds standard machine batch capacity of 1000 units.`);
    }

    const dbMachines = await prisma.machine.findMany();
    const machineExists = dbMachines.some(m => m.name.toLowerCase() === finalMachineName.toLowerCase());
    if (!machineExists) {
      validationErrors.push(`Blocker: Assigned machine '${finalMachineName}' is not registered in active plant assets.`);
    }

    if (!/#\d+/.test(finalOrderName)) {
      validationErrors.push(`Warning: Order name lacks a specific tracking identifier (e.g. #ID).`);
    }

    currentMeta.validationErrors = validationErrors;

    // Update inspection record
    const updatedInspection = await prisma.qualityInspection.update({
      where: { id },
      data: {
        status,
        inspectorName: inspectorName || 'QA Engineer',
        defectCount: validationErrors.filter(e => e.startsWith('Blocker:')).length,
        notes: JSON.stringify(currentMeta),
      },
    });

    // Update order status based on review decision
    let orderStatus = inspection.order.status;
    if (status === 'APPROVED') {
      // If approved, check if blockers are still present.
      const hasBlockers = validationErrors.some(e => e.startsWith('Blocker:'));
      orderStatus = hasBlockers ? 'SUSPENDED' : 'COMPLETED';
    } else if (status === 'REJECTED') {
      orderStatus = 'SUSPENDED';
    }

    await prisma.productOrder.update({
      where: { id: inspection.orderId },
      data: {
        name: finalOrderName,
        targetQuantity: parsedQty,
        status: orderStatus,
      },
    });

    // Create system log
    const action = status === 'APPROVED' ? 'DOC_VALIDATE' : 'DOC_REJECT';
    const severity = status === 'APPROVED' ? 'INFO' : 'ERROR';
    const details = `Document '${currentMeta.fileName}' was ${status} by ${inspectorName || 'QA Engineer'}. Errors remaining: ${validationErrors.length}. Comments: ${comments || 'None'}`;

    await prisma.systemLog.create({
      data: {
        action,
        details,
        severity,
        orderId: inspection.orderId,
      },
    });

    return NextResponse.json({
      success: true,
      inspection: updatedInspection,
    });
  } catch (error) {
    console.error('Inspection review error:', error);
    return NextResponse.json({ error: 'Failed to process inspection review' }, { status: 500 });
  }
}
