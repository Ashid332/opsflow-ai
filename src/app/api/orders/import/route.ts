import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractFieldsFromDocument } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = file.name;
    const mimeType = file.type || 'application/pdf';
    
    // Read raw buffer from file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Call Gemini Vision OCR helper
    const ocrResult = await extractFieldsFromDocument(buffer, mimeType);

    // Run AI Rules Engine Validation Checks
    const validationErrors: string[] = [];

    // Check 1: Target limit
    if (ocrResult.quantityProduced > 1000) {
      validationErrors.push(`Blocker: Extracted quantity (${ocrResult.quantityProduced}) exceeds standard machine batch capacity of 1000 units.`);
    }

    // Check 2: Machine registry check
    const dbMachines = await prisma.machine.findMany();
    const machineExists = dbMachines.some(
      m => m.name.toLowerCase() === ocrResult.machineNumber.toLowerCase()
    );
    if (!machineExists) {
      validationErrors.push(`Blocker: Assigned machine '${ocrResult.machineNumber}' is not registered in active plant assets.`);
    }

    // Check 3: Check low confidence ratings (Warning threshold 75%)
    Object.entries(ocrResult.confidence).forEach(([field, score]) => {
      if (score < 0.75) {
        // Format field name for user readability
        const fieldNameFormatted = field
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
        validationErrors.push(`Warning: Low OCR reading confidence (${Math.round(score * 100)}%) on '${fieldNameFormatted}'.`);
      }
    });

    // Check 4: Check if employee ID format is valid
    if (!ocrResult.employeeNumber || ocrResult.employeeNumber.trim() === '') {
      validationErrors.push(`Warning: Missing or unrecognized Employee Number.`);
    }

    const hasBlockers = validationErrors.some(e => e.startsWith('Blocker:'));

    // Create database records using existing models
    const orderNameMapping = ocrResult.workOrderNumber.startsWith('WO-') 
      ? `Work Order ${ocrResult.workOrderNumber}` 
      : ocrResult.workOrderNumber;

    const order = await prisma.productOrder.create({
      data: {
        name: orderNameMapping,
        targetQuantity: ocrResult.quantityProduced,
        quantity: 0, // Not yet started
        status: hasBlockers ? 'SUSPENDED' : 'PENDING',
      },
    });

    const extractionMetadata = {
      fileName,
      date: ocrResult.date,
      shift: ocrResult.shift,
      employeeNumber: ocrResult.employeeNumber,
      operationCode: ocrResult.operationCode,
      machineName: ocrResult.machineNumber,
      workOrderNumber: ocrResult.workOrderNumber,
      quantityProduced: ocrResult.quantityProduced,
      timeTaken: ocrResult.timeTaken,
      confidence: ocrResult.confidence,
      originalText: ocrResult.rawTextTranscription,
      validationErrors,
    };

    const inspection = await prisma.qualityInspection.create({
      data: {
        orderId: order.id,
        inspectorName: ocrResult.employeeNumber || 'AI OCR Agent',
        status: 'PENDING',
        defectCount: validationErrors.filter(e => e.startsWith('Blocker:')).length,
        notes: JSON.stringify(extractionMetadata),
      },
    });

    // Create system log
    await prisma.systemLog.create({
      data: {
        action: 'DOC_OCR_SCAN',
        details: `Gemini OCR scanned '${fileName}'. Extracted ${ocrResult.workOrderNumber} with ${validationErrors.length} validation tags.`,
        severity: hasBlockers ? 'WARNING' : 'INFO',
        orderId: order.id,
      },
    });

    return NextResponse.json({
      success: true,
      order,
      inspection,
    });
  } catch (error) {
    console.error('OCR API error:', error);
    return NextResponse.json({ error: 'Failed to process document Gemini Vision OCR' }, { status: 500 });
  }
}
