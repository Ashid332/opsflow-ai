import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, notes, inspectorName, defectCount } = body;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid inspection status' }, { status: 400 });
    }

    const inspection = await prisma.qualityInspection.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!inspection) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
    }

    const updatedInspection = await prisma.qualityInspection.update({
      where: { id },
      data: {
        status,
        notes: notes || inspection.notes,
        inspectorName: inspectorName || inspection.inspectorName,
        defectCount: defectCount !== undefined ? parseInt(defectCount, 10) : inspection.defectCount,
      },
    });

    // Update order status based on review decision
    let orderStatus = inspection.order.status;
    if (status === 'APPROVED') {
      orderStatus = 'COMPLETED';
    } else if (status === 'REJECTED') {
      orderStatus = 'SUSPENDED';
    }

    await prisma.productOrder.update({
      where: { id: inspection.orderId },
      data: { status: orderStatus },
    });

    // Create system log
    const action = status === 'APPROVED' ? 'INSPECTION_APPROVE' : 'INSPECTION_REJECT';
    const severity = status === 'APPROVED' ? 'INFO' : 'ERROR';
    const details = `Quality inspection for order '${inspection.order.name}' was ${status} by ${inspectorName || 'Unknown Inspector'}. Defects: ${defectCount || 0}. Notes: ${notes || 'None'}`;

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
