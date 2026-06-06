import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractFieldsFromDocument } from '@/lib/gemini';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let fileName = 'unknown';
  let mimeType = 'unknown';

  try {
    // Stage 1: Parse form data & Detect MIME type
    console.log('[UPLOAD] Stage 1: Parsing form data...');
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      console.error('[UPLOAD] Stage 1 Error: No file found in form data');
      return NextResponse.json(
        { error: 'No file uploaded. Please select a file to process.' },
        { status: 400 }
      );
    }

    fileName = file.name;
    const rawMimeType = file.type;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    
    // Robust extension fallback detection for generic MIME types (e.g. application/octet-stream)
    mimeType = rawMimeType;
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (fileExtension === 'pdf') mimeType = 'application/pdf';
      else if (fileExtension === 'png') mimeType = 'image/png';
      else if (fileExtension === 'jpg' || fileExtension === 'jpeg') mimeType = 'image/jpeg';
      else if (fileExtension === 'webp') mimeType = 'image/webp';
    }

    console.log(`[UPLOAD] Stage 1 Success: File received: "${fileName}" (Original MIME: "${rawMimeType}", Resolved MIME: "${mimeType}", Size: ${file.size} bytes)`);

    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];
    if (!allowedMimeTypes.includes(mimeType)) {
      console.error(`[UPLOAD] Stage 1 Error: Unsupported file type: MIME "${mimeType}", Extension "${fileExtension}"`);
      return NextResponse.json(
        { error: `Unsupported file type: "${mimeType || 'unknown'}". Please upload a PDF or image file (PNG, JPG, JPEG, WebP).` },
        { status: 400 }
      );
    }

    // Stage 2: Read file buffer
    console.log('[UPLOAD] Stage 2: Reading file buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[UPLOAD] Stage 2 Success: Buffer read: ${buffer.length} bytes`);

    if (buffer.length === 0) {
      console.error('[UPLOAD] Stage 2 Error: Uploaded file buffer is empty');
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
      const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExtension || 'pdf'}`;
      const filePath = path.join(uploadsDir, uniqueFileName);
      await fs.writeFile(filePath, buffer);
      fileUrl = `/uploads/${uniqueFileName}`;
      console.log(`[UPLOAD] Stage 3 Success: File saved to: ${fileUrl}`);
    } catch (fsError) {
      // On serverless (Vercel), filesystem writes may fail — this is expected
      const fsErrorMsg = fsError instanceof Error ? fsError.message : String(fsError);
      console.warn('[UPLOAD] Stage 3 Warning: File save failed (expected on serverless):', fsErrorMsg);
      fileUrl = `/uploads/ephemeral-${Date.now()}.${fileExtension || 'pdf'}`;
    }

    // Stage 4: Gemini Vision OCR
    console.log('[UPLOAD] Stage 4: Starting Gemini Vision OCR...');
    const apiKey = process.env.GEMINI_API_KEY;
    const apiKeyExists = !!apiKey;
    const apiKeyLength = apiKey ? apiKey.length : 0;
    const apiKeyPrefix = apiKey ? apiKey.substring(0, 10) : 'none';
    console.log(`[UPLOAD] GEMINI_API_KEY validation check - Exists: ${apiKeyExists}, Length: ${apiKeyLength}, Prefix: "${apiKeyPrefix}..."`);
    
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your-google-gemini-api-key-here') {
      console.error('[UPLOAD] Stage 4 Error: GEMINI_API_KEY is not set or contains default placeholder');
      return NextResponse.json(
        { error: 'Server configuration error: GEMINI_API_KEY is not configured. Please add a valid Google Gemini API key to the environment variables.' },
        { status: 503 }
      );
    }

    let ocrResult;
    try {
      console.log(`[UPLOAD] Calling extractFieldsFromDocument with buffer length: ${buffer.length}, MIME: "${mimeType}"...`);
      ocrResult = await extractFieldsFromDocument(buffer, mimeType);
      console.log('[UPLOAD] Stage 4 Success: OCR response parsed from Gemini API.');
    } catch (ocrError) {
      const errorMessage = ocrError instanceof Error ? ocrError.message : String(ocrError);
      const errorStack = ocrError instanceof Error ? ocrError.stack : '';
      console.error('[UPLOAD] Stage 4 Error: Gemini OCR failed:', errorMessage);
      console.error('[UPLOAD] Stage 4 Gemini Error Stack:', errorStack);
      
      if (errorMessage.includes('API_KEY') || errorMessage.includes('API key')) {
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

    // Stage 4.5: Sanitize & Normalize OCR fields to prevent runtime exceptions
    console.log('[UPLOAD] Stage 4.5: Sanitizing and normalizing extracted fields...');
    const sanitizedOcrResult = {
      date: typeof ocrResult?.date === 'string' ? ocrResult.date.trim() : '',
      shift: typeof ocrResult?.shift === 'string' ? ocrResult.shift.trim() : '',
      employeeNumber: typeof ocrResult?.employeeNumber === 'string' ? ocrResult.employeeNumber.trim() : '',
      operationCode: typeof ocrResult?.operationCode === 'string' ? ocrResult.operationCode.trim() : '',
      machineNumber: typeof ocrResult?.machineNumber === 'string' ? ocrResult.machineNumber.trim() : '',
      workOrderNumber: typeof ocrResult?.workOrderNumber === 'string' ? ocrResult.workOrderNumber.trim() : '',
      quantityProduced: typeof ocrResult?.quantityProduced === 'number' && !isNaN(ocrResult.quantityProduced) 
        ? Math.round(ocrResult.quantityProduced) 
        : 0,
      timeTaken: typeof ocrResult?.timeTaken === 'string' ? ocrResult.timeTaken.trim() : '',
      rawTextTranscription: typeof ocrResult?.rawTextTranscription === 'string' ? ocrResult.rawTextTranscription.trim() : '',
      confidence: {
        date: typeof ocrResult?.confidence?.date === 'number' && !isNaN(ocrResult.confidence.date) ? ocrResult.confidence.date : 0,
        shift: typeof ocrResult?.confidence?.shift === 'number' && !isNaN(ocrResult.confidence.shift) ? ocrResult.confidence.shift : 0,
        employeeNumber: typeof ocrResult?.confidence?.employeeNumber === 'number' && !isNaN(ocrResult.confidence.employeeNumber) ? ocrResult.confidence.employeeNumber : 0,
        operationCode: typeof ocrResult?.confidence?.operationCode === 'number' && !isNaN(ocrResult.confidence.operationCode) ? ocrResult.confidence.operationCode : 0,
        machineNumber: typeof ocrResult?.confidence?.machineNumber === 'number' && !isNaN(ocrResult.confidence.machineNumber) 
          ? ocrResult.confidence.machineNumber 
          : 0,
        workOrderNumber: typeof ocrResult?.confidence?.workOrderNumber === 'number' && !isNaN(ocrResult.confidence.workOrderNumber) ? ocrResult.confidence.workOrderNumber : 0,
        quantityProduced: typeof ocrResult?.confidence?.quantityProduced === 'number' && !isNaN(ocrResult.confidence.quantityProduced) ? ocrResult.confidence.quantityProduced : 0,
        timeTaken: typeof ocrResult?.confidence?.timeTaken === 'number' && !isNaN(ocrResult.confidence.timeTaken) ? ocrResult.confidence.timeTaken : 0,
      }
    };
    console.log('[UPLOAD] Stage 4.5 Success: Sanitized OCR data values:', {
      workOrderNumber: sanitizedOcrResult.workOrderNumber,
      machineNumber: sanitizedOcrResult.machineNumber,
      quantityProduced: sanitizedOcrResult.quantityProduced,
    });

    // Stage 5: Validation Rules Engine
    console.log('[UPLOAD] Stage 5: Running validation rules engine...');
    const validationErrors: string[] = [];

    // Check 1: Target limit
    if (sanitizedOcrResult.quantityProduced > 1000) {
      validationErrors.push(`Blocker: Extracted quantity (${sanitizedOcrResult.quantityProduced}) exceeds standard machine batch capacity of 1000 units.`);
    }

    // Check 2: Machine registry check
    try {
      const dbMachines = await prisma.machine.findMany();
      const machineExists = dbMachines.some(
        m => m.name.toLowerCase() === sanitizedOcrResult.machineNumber.toLowerCase()
      );
      if (!machineExists) {
        validationErrors.push(`Blocker: Assigned machine '${sanitizedOcrResult.machineNumber}' is not registered in active plant assets.`);
      }
    } catch (dbError) {
      const dbErrorMsg = dbError instanceof Error ? dbError.message : String(dbError);
      console.warn('[UPLOAD] Stage 5 Warning: Machine registry check failed (non-blocking):', dbErrorMsg);
      validationErrors.push(`Warning: Could not verify machine '${sanitizedOcrResult.machineNumber}' against plant registry.`);
    }

    // Check 3: Check low confidence ratings (Warning threshold 75%)
    Object.entries(sanitizedOcrResult.confidence).forEach(([field, score]) => {
      if (score < 0.75) {
        const fieldNameFormatted = field
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
        validationErrors.push(`Warning: Low OCR reading confidence (${Math.round(score * 100)}%) on '${fieldNameFormatted}'.`);
      }
    });

    // Check 4: Check if employee ID format is valid
    if (!sanitizedOcrResult.employeeNumber || sanitizedOcrResult.employeeNumber.trim() === '') {
      validationErrors.push(`Warning: Missing or unrecognized Employee Number.`);
    }

    const hasBlockers = validationErrors.some(e => e.startsWith('Blocker:'));
    console.log(`[UPLOAD] Stage 5 Success: Validation complete: ${validationErrors.length} issues found (${hasBlockers ? 'HAS BLOCKERS' : 'no blockers'})`);

    // Stage 6: Create database records
    console.log('[UPLOAD] Stage 6: Creating database records...');
    
    let order;
    let inspection;
    
    try {
      const isPlaceholder = !sanitizedOcrResult.workOrderNumber || 
                            ['null', 'n/a', 'none', 'undefined', 'not available'].includes(sanitizedOcrResult.workOrderNumber.toLowerCase());

      const orderNameMapping = !isPlaceholder
        ? (sanitizedOcrResult.workOrderNumber.startsWith('WO-') 
            ? `Work Order ${sanitizedOcrResult.workOrderNumber}` 
            : sanitizedOcrResult.workOrderNumber)
        : `Order-${Date.now()}`;

      order = await prisma.productOrder.create({
        data: {
          name: orderNameMapping,
          targetQuantity: sanitizedOcrResult.quantityProduced,
          quantity: 0,
          status: hasBlockers ? 'SUSPENDED' : 'PENDING',
        },
      });
      console.log(`[UPLOAD] Stage 6 DB Write: ProductOrder created with ID: ${order.id}`);

      const extractionMetadata = {
        fileName,
        fileUrl,
        fileType: mimeType,
        date: sanitizedOcrResult.date,
        shift: sanitizedOcrResult.shift,
        employeeNumber: sanitizedOcrResult.employeeNumber,
        operationCode: sanitizedOcrResult.operationCode,
        machineName: sanitizedOcrResult.machineNumber,
        workOrderNumber: sanitizedOcrResult.workOrderNumber,
        quantityProduced: sanitizedOcrResult.quantityProduced,
        timeTaken: sanitizedOcrResult.timeTaken,
        confidence: sanitizedOcrResult.confidence,
        originalText: sanitizedOcrResult.rawTextTranscription,
        validationErrors,
      };

      inspection = await prisma.qualityInspection.create({
        data: {
          orderId: order.id,
          inspectorName: sanitizedOcrResult.employeeNumber || 'AI OCR Agent',
          status: 'PENDING',
          defectCount: validationErrors.filter(e => e.startsWith('Blocker:')).length,
          notes: JSON.stringify(extractionMetadata),
        },
      });
      console.log(`[UPLOAD] Stage 6 DB Write: QualityInspection created with ID: ${inspection.id}`);

      // Create system log
      await prisma.systemLog.create({
        data: {
          action: 'DOC_OCR_SCAN',
          details: `Gemini OCR scanned '${fileName}'. Extracted ${sanitizedOcrResult.workOrderNumber || 'unknown WO'} with ${validationErrors.length} validation tags.`,
          severity: hasBlockers ? 'WARNING' : 'INFO',
          orderId: order.id,
        },
      });
      console.log('[UPLOAD] Stage 6 DB Write: SystemLog created successfully.');
    } catch (dbError) {
      const dbErrorMsg = dbError instanceof Error ? dbError.message : String(dbError);
      const dbErrorStack = dbError instanceof Error ? dbError.stack : '';
      console.error('[UPLOAD] Stage 6 Error: Database operations failed:', dbErrorMsg);
      console.error('[UPLOAD] Stage 6 Database Error Stack:', dbErrorStack);
      return NextResponse.json(
        { error: `Database error while saving records: ${dbErrorMsg}` },
        { status: 500 }
      );
    }

    const elapsed = Date.now() - startTime;
    console.log(`[UPLOAD] Stage 6 Success: Pipeline complete in ${elapsed}ms`);

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
      { error: `Upload processing failed due to server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
