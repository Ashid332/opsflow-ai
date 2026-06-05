import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = file.name;
    const fileText = await file.text();

    // 1. Generate Mock Extraction Fields (representing AI OCR output)
    let extractedName = 'Batch Run Sheet';
    let targetQuantity = 500;
    let machineName = 'Assembly Line A (CNC)';
    let shiftName = 'Morning Shift';

    // Parse simple CSV/JSON if provided, otherwise randomize mock values
    if (fileName.endsWith('.json')) {
      try {
        const parsed = JSON.parse(fileText);
        extractedName = parsed.name || extractedName;
        targetQuantity = parsed.targetQuantity || targetQuantity;
        machineName = parsed.machine || machineName;
        shiftName = parsed.shift || shiftName;
      } catch (e) {
        // Fallback to defaults
      }
    } else if (fileName.endsWith('.csv')) {
      const lines = fileText.split('\n');
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2 && !line.toLowerCase().includes('name')) {
          extractedName = parts[0]?.trim() || extractedName;
          targetQuantity = parseInt(parts[1]?.trim() || '500', 10);
          if (parts[2]) machineName = parts[2].trim();
          if (parts[3]) shiftName = parts[3].trim();
          break;
        }
      }
    } else {
      // General file (PDF/Image) mock extraction
      const rand = Math.random();
      if (rand < 0.3) {
        extractedName = 'Valves Production #982';
        targetQuantity = 1200; // Will trigger quantity validation error
        machineName = 'Assembly Line A (CNC)';
        shiftName = 'Afternoon Shift';
      } else if (rand < 0.6) {
        extractedName = 'Piston Castings Batch'; // Unclear name -> warning
        targetQuantity = 450;
        machineName = 'Laser Cutter F'; // Will trigger machine validation error
        shiftName = 'Night Shift';
      } else {
        extractedName = 'Auto-Chassis Batch #512';
        targetQuantity = 750;
        machineName = 'Welding Robot B';
        shiftName = 'Morning Shift';
      }
    }

    // 2. Generate Confidence Indicators (0.0 to 1.0)
    const confName = parseFloat((0.85 + Math.random() * 0.14).toFixed(2));
    const confQty = targetQuantity === 1200 ? 0.72 : parseFloat((0.80 + Math.random() * 0.19).toFixed(2)); // purposefully low confidence for test
    const confMachine = machineName === 'Laser Cutter F' ? 0.65 : parseFloat((0.90 + Math.random() * 0.09).toFixed(2));
    const confShift = parseFloat((0.88 + Math.random() * 0.11).toFixed(2));

    // 3. Evaluate Validation Panel Checks
    const validationErrors: string[] = [];
    
    // Check 1: Target limit
    if (targetQuantity > 1000) {
      validationErrors.push(`Blocker: Target quantity (${targetQuantity}) exceeds standard machine batch capacity of 1000 units.`);
    }
    
    // Check 2: Machine validation
    const dbMachines = await prisma.machine.findMany();
    const machineExists = dbMachines.some(m => m.name.toLowerCase() === machineName.toLowerCase());
    if (!machineExists) {
      validationErrors.push(`Blocker: Assigned machine '${machineName}' is not registered in active plant assets.`);
    }

    // Check 3: Name pattern warnings
    if (!/#\d+/.test(extractedName)) {
      validationErrors.push(`Warning: Order name lacks a specific tracking identifier (e.g. #ID).`);
    }

    // Check 4: Low confidence warnings
    if (confQty < 0.80) {
      validationErrors.push(`Warning: Low OCR reading confidence (${Math.round(confQty * 100)}%) on Target Quantity.`);
    }
    if (confMachine < 0.80) {
      validationErrors.push(`Warning: Low OCR reading confidence (${Math.round(confMachine * 100)}%) on Assigned Machine.`);
    }

    // 4. Create database records using existing models
    const order = await prisma.productOrder.create({
      data: {
        name: extractedName,
        targetQuantity: targetQuantity,
        quantity: 0, // Not yet started
        status: validationErrors.some(e => e.startsWith('Blocker:')) ? 'SUSPENDED' : 'PENDING',
      },
    });

    const mockOcrText = `[SCAN SHEET HEADER]\nDOCUMENT TYPE: WORK ORDER RUN SHEET\nFILE: ${fileName}\nTIMESTAMP: ${new Date().toISOString()}\n---------------------------------------\nBATCH NAME: ${extractedName}\nTARGET QTY: ${targetQuantity} units\nMACHINE TARGET: ${machineName}\nSHIFT TARGET: ${shiftName}\nQA SIGN-OFF REQUIRED: YES\n[FOOTER BARCODE SIGNATURE]`;

    const extractionMetadata = {
      fileName,
      originalText: mockOcrText,
      shift: shiftName,
      machineName: machineName,
      confidence: {
        name: confName,
        targetQuantity: confQty,
        machineName: confMachine,
        shift: confShift
      },
      validationErrors,
    };

    const inspection = await prisma.qualityInspection.create({
      data: {
        orderId: order.id,
        inspectorName: 'AI Extraction Agent',
        status: 'PENDING',
        defectCount: validationErrors.filter(e => e.startsWith('Blocker:')).length, // mapping validation blockages to defects
        notes: JSON.stringify(extractionMetadata),
      },
    });

    // Create system log
    await prisma.systemLog.create({
      data: {
        action: 'DOC_UPLOAD',
        details: `Uploaded document '${fileName}'. AI extracted order '${extractedName}' with ${validationErrors.length} validation tags.`,
        severity: validationErrors.some(e => e.startsWith('Blocker:')) ? 'WARNING' : 'INFO',
        orderId: order.id,
      },
    });

    return NextResponse.json({
      success: true,
      order,
      inspection,
    });
  } catch (error) {
    console.error('OCR import API error:', error);
    return NextResponse.json({ error: 'Failed to process document upload' }, { status: 500 });
  }
}
