import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractFieldsFromDocument } from '@/lib/gemini';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let fileName = 'unknown';

  try {
    // Stage 1: Parse form data
    console.log('[UPLOAD] Stage 1: Parsing form data...');
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      console.error('[UPLOAD] No file found in form data');
      return NextResponse.json(
        { error: 'No file uploaded. Please select a file to process.' },
        { status: 400 }
      );
    }

    fileName = file.name;
    const mimeType = file.type || 'application/pdf';
    console.log(`[UPLOAD] File received: ${fileName} (${mimeType}, ${file.size} bytes)`);

    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];
    if (!allowedMimeTypes.includes(mimeType)) {
      console.error(`[UPLOAD] Unsupported MIME type: ${mimeType}`);
      return NextResponse.json(
        { error: `Unsupported file type: ${mimeType}. Please upload a PDF or image file (PNG, JPG, JPEG, WebP).` },
        { status: 400 }
      );
    }

    // Stage 2: Read file buffer
    console.log('[UPLOAD] Stage 2: Reading file buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[UPLOAD] Buffer read: ${buffer.length} bytes`);

    if (buffer.length === 0) {
      return NextResponse.json(
        { error: 'Uploaded file is empty. Please select a valid document.' },
        { status: 400 }
      );
    }

    // Stage 3: Save file to public/uploads (best-effort, non-blocking for deployment)
    let fileUrl = '';
    try {
      console.log('[UPLOAD] Stage 3: Saving file to uploads directory...');
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(uploadsDir, { recursive: true });
      const fileExtension = fileName.split('.').pop() || 'pdf';
      const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;
      const filePath = path.join(uploadsDir, uniqueFileName);
      await fs.writeFile(filePath, buffer);
      fileUrl = `/uploads/${uniqueFileName}`;
      console.log(`[UPLOAD] File saved: ${fileUrl}`);
    } catch (fsError) {
      // On serverless (Vercel), filesystem writes may fail — this is expected
      console.warn('[UPLOAD] File save failed (expected on serverless):', fsError instanceof Error ? fsError.message : fsError);
      fileUrl = `/uploads/ephemeral-${Date.now()}.${fileName.split('.').pop() || 'pdf'}`;
    }

    // Stage 4: Gemini Vision OCR
    console.log('[UPLOAD] Stage 4: Starting Gemini Vision OCR...');
    console.log(`[UPLOAD] GEMINI_API_KEY configured: ${!!process.env.GEMINI_API_KEY}`);
    
    if (!process.env.GEMINI_API_KEY) {
      console.error('[UPLOAD] GEMINI_API_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error: GEMINI_API_KEY is not configured. Please add your Google Gemini API key to the environment variables.' },
        { status: 503 }
      );
    }

    let ocrResult;
    try {
      ocrResult = await extractFieldsFromDocument(buffer, mimeType);
      console.log('[UPLOAD] OCR extraction successful:', {
        workOrder: ocrResult.workOrderNumber,
        machine: ocrResult.machineNumber,
        quantity: ocrResult.quantityProduced,
      });
    } catch (ocrError) {
      const errorMessage = ocrError instanceof Error ? ocrError.message : String(ocrError);
      console.error('[UPLOAD] Gemini OCR failed:', errorMessage);
      
      if (errorMessage.includes('API_KEY')) {
        return NextResponse.json(
          { error: 'Gemini API key is invalid or not configured. Please check your GEMINI_API_KEY environment variable.' },
          { status: 503 }
        );
      }
      if (errorMessage.includes('SAFETY') || errorMessage.includes('blocked')) {
        return NextResponse.json(
          { error: 'Document was blocked by Gemini safety filters. Please try a different document.' },
          { status: 422 }
        );
      }
      if (errorMessage.includes('quota') || errorMessage.includes('rate')) {
        return NextResponse.json(
          { error: 'Gemini API rate limit reached. Please wait a moment and try again.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `OCR processing failed: ${errorMessage}` },
        { status: 500 }
      );
    }

    // Stage 5: Validation Rules Engine
    console.log('[UPLOAD] Stage 5: Running validation rules engine...');
    const validationErrors: string[] = [];

    // Check 1: Target limit
    if (ocrResult.quantityProduced > 1000) {
      validationErrors.push(`Blocker: Extracted quantity (${ocrResult.quantityProduced}) exceeds standard machine batch capacity of 1000 units.`);
    }

    // Check 2: Machine registry check
    try {
      const dbMachines = await prisma.machine.findMany();
      const machineExists = dbMachines.some(
        m => m.name.toLowerCase() === ocrResult.machineNumber.toLowerCase()
      );
      if (!machineExists) {
        validationErrors.push(`Blocker: Assigned machine '${ocrResult.machineNumber}' is not registered in active plant assets.`);
      }
    } catch (dbError) {
      console.warn('[UPLOAD] Machine registry check failed (non-blocking):', dbError instanceof Error ? dbError.message : dbError);
      validationErrors.push(`Warning: Could not verify machine '${ocrResult.machineNumber}' against plant registry.`);
    }

    // Check 3: Check low confidence ratings (Warning threshold 75%)
    Object.entries(ocrResult.confidence).forEach(([field, score]) => {
      if (score < 0.75) {
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
    console.log(`[UPLOAD] Validation complete: ${validationErrors.length} issues found (${hasBlockers ? 'HAS BLOCKERS' : 'no blockers'})`);

    // Stage 6: Create database records
    console.log('[UPLOAD] Stage 6: Creating database records...');
    
    let order;
    let inspection;
    
    try {
      const orderNameMapping = ocrResult.workOrderNumber.startsWith('WO-') 
        ? `Work Order ${ocrResult.workOrderNumber}` 
        : ocrResult.workOrderNumber;

      order = await prisma.productOrder.create({
        data: {
          name: orderNameMapping,
          targetQuantity: ocrResult.quantityProduced,
          quantity: 0,
          status: hasBlockers ? 'SUSPENDED' : 'PENDING',
        },
      });
      console.log(`[UPLOAD] ProductOrder created: ${order.id}`);

      const extractionMetadata = {
        fileName,
        fileUrl,
        fileType: mimeType,
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

      inspection = await prisma.qualityInspection.create({
        data: {
          orderId: order.id,
          inspectorName: ocrResult.employeeNumber || 'AI OCR Agent',
          status: 'PENDING',
          defectCount: validationErrors.filter(e => e.startsWith('Blocker:')).length,
          notes: JSON.stringify(extractionMetadata),
        },
      });
      console.log(`[UPLOAD] QualityInspection created: ${inspection.id}`);

      // Create system log
      await prisma.systemLog.create({
        data: {
          action: 'DOC_OCR_SCAN',
          details: `Gemini OCR scanned '${fileName}'. Extracted ${ocrResult.workOrderNumber} with ${validationErrors.length} validation tags.`,
          severity: hasBlockers ? 'WARNING' : 'INFO',
          orderId: order.id,
        },
      });
      console.log('[UPLOAD] SystemLog created');
    } catch (dbError) {
      const dbErrorMsg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error('[UPLOAD] Database operation failed:', dbErrorMsg);
      return NextResponse.json(
        { error: `Database error while saving records: ${dbErrorMsg}` },
        { status: 500 }
      );
    }

    const elapsed = Date.now() - startTime;
    console.log(`[UPLOAD] Pipeline complete in ${elapsed}ms`);

    return NextResponse.json({
      success: true,
      order,
      inspection,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error(`[UPLOAD] Unhandled error processing '${fileName}':`, errorMessage);
    console.error('[UPLOAD] Stack trace:', errorStack);
    
    return NextResponse.json(
      { error: `Upload processing failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
