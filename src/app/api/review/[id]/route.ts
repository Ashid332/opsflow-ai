import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { 
      status, 
      inspectorName, 
      date, 
      shift, 
      employeeNumber, 
      operationCode, 
      machineName, 
      workOrderNumber, 
      targetQuantity, 
      timeTaken, 
      comments 
    } = body;

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
      date: date || '',
      shift: shift || 'Morning Shift',
      employeeNumber: employeeNumber || '',
      operationCode: operationCode || '',
      machineName: machineName || '',
      workOrderNumber: workOrderNumber || '',
      quantityProduced: targetQuantity !== undefined ? targetQuantity : 0,
      timeTaken: timeTaken || '',
      confidence: {
        date: 1.0,
        shift: 1.0,
        employeeNumber: 1.0,
        operationCode: 1.0,
        machineName: 1.0,
        workOrderNumber: 1.0,
        quantityProduced: 1.0,
        timeTaken: 1.0
      },
      validationErrors: [] as string[],
      originalText: ''
    };

    try {
      if (inspection.notes) {
        const parsed = JSON.parse(inspection.notes);
        currentMeta = { ...currentMeta, ...parsed };
      }
    } catch (e) {
      // Use defaults
    }

    // Apply human corrected values and set confidence to 100% (1.0)
    if (date !== undefined) {
      currentMeta.date = date;
      currentMeta.confidence.date = 1.0;
    }
    if (shift !== undefined) {
      currentMeta.shift = shift;
      currentMeta.confidence.shift = 1.0;
    }
    if (employeeNumber !== undefined) {
      currentMeta.employeeNumber = employeeNumber;
      currentMeta.confidence.employeeNumber = 1.0;
    }
    if (operationCode !== undefined) {
      currentMeta.operationCode = operationCode;
      currentMeta.confidence.operationCode = 1.0;
    }
    if (machineName !== undefined) {
      currentMeta.machineName = machineName;
      currentMeta.confidence.machineName = 1.0;
    }
    if (workOrderNumber !== undefined) {
      currentMeta.workOrderNumber = workOrderNumber;
      currentMeta.confidence.workOrderNumber = 1.0;
    }
    if (targetQuantity !== undefined) {
      currentMeta.quantityProduced = targetQuantity;
      currentMeta.confidence.quantityProduced = 1.0;
    }
    if (timeTaken !== undefined) {
      currentMeta.timeTaken = timeTaken;
      currentMeta.confidence.timeTaken = 1.0;
    }

    // Re-evaluate validation constraints on the corrected inputs
    const validationErrors: string[] = [];
    const parsedQty = currentMeta.quantityProduced;
    const finalMachineName = currentMeta.machineName;
    const finalWorkOrderNumber = currentMeta.workOrderNumber;
    const finalEmployeeNumber = currentMeta.employeeNumber;

    if (parsedQty > 1000) {
      validationErrors.push(`Blocker: Extracted quantity (${parsedQty}) exceeds standard machine batch capacity of 1000 units.`);
    }

    const dbMachines = await prisma.machine.findMany();
    const machineExists = dbMachines.some(
      m => m.name.toLowerCase() === finalMachineName.toLowerCase()
    );
    if (!machineExists) {
      validationErrors.push(`Blocker: Assigned machine '${finalMachineName}' is not registered in active plant assets.`);
    }

    if (!finalEmployeeNumber || finalEmployeeNumber.trim() === '') {
      validationErrors.push(`Warning: Missing or unrecognized Employee Number.`);
    }

    currentMeta.validationErrors = validationErrors;
    const hasBlockers = validationErrors.some(e => e.startsWith('Blocker:'));

    // Update inspection record
    const updatedInspection = await prisma.qualityInspection.update({
      where: { id },
      data: {
        status,
        inspectorName: inspectorName || 'QA Supervisor',
        defectCount: validationErrors.filter(e => e.startsWith('Blocker:')).length,
        notes: JSON.stringify(currentMeta),
      },
    });

    // Update order status based on review decision
    let orderStatus = inspection.order.status;
    if (status === 'APPROVED') {
      orderStatus = hasBlockers ? 'SUSPENDED' : 'COMPLETED';
    } else if (status === 'REJECTED') {
      orderStatus = 'SUSPENDED';
    }

    const orderNameMapping = finalWorkOrderNumber.startsWith('WO-') 
      ? `Work Order ${finalWorkOrderNumber}` 
      : finalWorkOrderNumber;

    await prisma.productOrder.update({
      where: { id: inspection.orderId },
      data: {
        name: orderNameMapping || inspection.order.name,
        targetQuantity: parsedQty,
        status: orderStatus,
      },
    });

    // Create system log
    const action = status === 'APPROVED' ? 'DOC_VALIDATE' : 'DOC_REJECT';
    const severity = status === 'APPROVED' ? 'INFO' : 'ERROR';
    const details = `Document '${currentMeta.fileName}' (WO: ${finalWorkOrderNumber}) was ${status} by verifier ${inspectorName || 'QA Supervisor'}. Blockers left: ${validationErrors.filter(e => e.startsWith('Blocker:')).length}.`;

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
