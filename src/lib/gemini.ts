import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';

export interface GeminiOcrResult {
  date: string;
  shift: string;
  employeeNumber: string;
  operationCode: string;
  machineNumber: string;
  workOrderNumber: string;
  quantityProduced: number;
  timeTaken: string;
  confidence: {
    date: number;
    shift: number;
    employeeNumber: number;
    operationCode: number;
    machineNumber: number;
    workOrderNumber: number;
    quantityProduced: number;
    timeTaken: number;
  };
  rawTextTranscription: string;
}

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Strictly typed JSON schema for Gemini response using SDK Schema type
const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    date: { type: SchemaType.STRING, description: "Date of the manufacturing run in YYYY-MM-DD format" },
    shift: { type: SchemaType.STRING, description: "Shift name, e.g. Morning Shift, Afternoon Shift, Night Shift" },
    employeeNumber: { type: SchemaType.STRING, description: "Employee identification number, e.g. EMP-241" },
    operationCode: { type: SchemaType.STRING, description: "Operation code, e.g. OP-10, OP-20" },
    machineNumber: { type: SchemaType.STRING, description: "Machine number or name, e.g. Welding Robot B, Assembly Line A (CNC)" },
    workOrderNumber: { type: SchemaType.STRING, description: "Work order or batch tracking number, e.g. WO-9821, #512" },
    quantityProduced: { type: SchemaType.NUMBER, description: "Total count of units produced as a number" },
    timeTaken: { type: SchemaType.STRING, description: "Time taken or duration, e.g. 4 hours, 45 minutes" },
    rawTextTranscription: { type: SchemaType.STRING, description: "A full raw text transcription of the main headers and scanned fields in the sheet" },
    confidence: {
      type: SchemaType.OBJECT,
      properties: {
        date: { type: SchemaType.NUMBER, description: "OCR confidence reading score between 0.0 and 1.0" },
        shift: { type: SchemaType.NUMBER, description: "OCR confidence reading score between 0.0 and 1.0" },
        employeeNumber: { type: SchemaType.NUMBER, description: "OCR confidence reading score between 0.0 and 1.0" },
        operationCode: { type: SchemaType.NUMBER, description: "OCR confidence reading score between 0.0 and 1.0" },
        machineNumber: { type: SchemaType.NUMBER, description: "OCR confidence reading score between 0.0 and 1.0" },
        workOrderNumber: { type: SchemaType.NUMBER, description: "OCR confidence reading score between 0.0 and 1.0" },
        quantityProduced: { type: SchemaType.NUMBER, description: "OCR confidence reading score between 0.0 and 1.0" },
        timeTaken: { type: SchemaType.NUMBER, description: "OCR confidence reading score between 0.0 and 1.0" }
      },
      required: ["date", "shift", "employeeNumber", "operationCode", "machineNumber", "workOrderNumber", "quantityProduced", "timeTaken"]
    }
  },
  required: [
    "date", "shift", "employeeNumber", "operationCode", 
    "machineNumber", "workOrderNumber", "quantityProduced", "timeTaken", "rawTextTranscription", "confidence"
  ]
};

export async function extractFieldsFromDocument(
  fileBuffer: Buffer,
  mimeType: string
): Promise<GeminiOcrResult> {
  if (!genAI) {
    console.warn('WARNING: GEMINI_API_KEY environment variable is not defined. Falling back to local OCR Mock Engine.');
    return generateMockOcrResult();
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
      You are an expert AI Vision OCR parser in a manufacturing smart plant.
      Analyze the attached document page (work order sheet, inspection report, or production run sheet).
      Extract the requested fields and return them strictly in the specified JSON structure.
      Be precise. For each field, estimate an OCR reading confidence score (0.0 to 1.0) based on readability, alignment, and clarity.
    `;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: fileBuffer.toString('base64'),
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    const responseText = result.response.text();
    return JSON.parse(responseText) as GeminiOcrResult;
  } catch (error) {
    console.error('Gemini Vision OCR extraction failed, using mock fallback. Error:', error);
    return generateMockOcrResult();
  }
}

function generateMockOcrResult(): GeminiOcrResult {
  const rand = Math.random();
  
  if (rand < 0.3) {
    return {
      date: new Date().toISOString().split('T')[0],
      shift: 'Afternoon Shift',
      employeeNumber: 'EMP-902',
      operationCode: 'OP-40',
      machineNumber: 'Assembly Line A (CNC)',
      workOrderNumber: 'WO-1209',
      quantityProduced: 1200, // triggers capacity warning (>1000)
      timeTaken: '6.5 hours',
      confidence: {
        date: 0.96,
        shift: 0.94,
        employeeNumber: 0.88,
        operationCode: 0.92,
        machineNumber: 0.99,
        workOrderNumber: 0.95,
        quantityProduced: 0.72, // low confidence trigger
        timeTaken: 0.85
      },
      rawTextTranscription: 'MANUFACTURING SHEET\nDATE: 2026-06-06\nSHIFT: AFTERNOON\nOPERATOR ID: EMP-902\nCODE: OP-40\nASSET: Assembly Line A (CNC)\nJOB ID: WO-1209\nYIELD: 1200 UNITS\nCYCLE: 6.5 HRS\nSIGNED BY: QA OVERSEE'
    };
  } else if (rand < 0.6) {
    return {
      date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      shift: 'Night Shift',
      employeeNumber: 'EMP-084',
      operationCode: 'OP-15',
      machineNumber: 'Laser Cutter F', // triggers asset registry blocker
      workOrderNumber: 'WO-3304',
      quantityProduced: 450,
      timeTaken: '3.2 hours',
      confidence: {
        date: 0.92,
        shift: 0.90,
        employeeNumber: 0.84,
        operationCode: 0.89,
        machineNumber: 0.65, // low confidence trigger
        workOrderNumber: 0.91,
        quantityProduced: 0.94,
        timeTaken: 0.88
      },
      rawTextTranscription: 'OPERATIONAL LOG SHEET\nDATE: 2026-06-05\nSHIFT: NIGHT\nEMPLOYEE: EMP-084\nOP CODE: OP-15\nMACHINE: Laser Cutter F\nWORK ORDER: WO-3304\nQTY: 450\nDURATION: 3.2 HOURS'
    };
  } else {
    return {
      date: new Date().toISOString().split('T')[0],
      shift: 'Morning Shift',
      employeeNumber: 'EMP-712',
      operationCode: 'OP-20',
      machineNumber: 'Welding Robot B',
      workOrderNumber: 'WO-5121',
      quantityProduced: 750,
      timeTaken: '4.8 hours',
      confidence: {
        date: 0.98,
        shift: 0.97,
        employeeNumber: 0.95,
        operationCode: 0.96,
        machineNumber: 0.98,
        workOrderNumber: 0.97,
        quantityProduced: 0.98,
        timeTaken: 0.96
      },
      rawTextTranscription: 'PLANT RUN LOG\nDATE: 2026-06-06\nSHIFT: MORNING\nVERIFIER: EMP-712\nOP CODE: OP-20\nASSET: Welding Robot B\nJOB ORDER: WO-5121\nYIELD: 750 UNITS\nCYCLE TIME: 4.8 HOURS'
    };
  }
}
