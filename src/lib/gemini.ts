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

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your-google-gemini-api-key-here') {
    throw new Error(
      'GEMINI_API_KEY is not configured. ' +
      'Please set a valid Google Gemini API key in your environment variables. ' +
      'Get a free key at https://aistudio.google.com/apikey'
    );
  }
  return new GoogleGenerativeAI(apiKey);
}

export async function extractFieldsFromDocument(
  fileBuffer: Buffer,
  mimeType: string
): Promise<GeminiOcrResult> {
  console.log('[GEMINI] Initializing Gemini client...');
  const genAI = getGeminiClient();

  console.log('[GEMINI] Creating model instance (gemini-2.5-flash)...');
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
    You are an expert AI Vision OCR parser in a manufacturing smart plant.
    Analyze the attached document page (which could be a work order sheet, inspection report, production run sheet, log table, or scan form).
    
    Instructions:
    1. Read the sheet header and tabular entries very carefully.
    2. Extract the following fields:
       - date: Look for headers like "Date", "Run Date", "Created Date", or similar (format as YYYY-MM-DD). If not found, look for date entries in the rows.
       - shift: Look for "Shift" (Morning Shift, Afternoon Shift, Night Shift, or I/II/III). Normalize "I" to "Morning Shift", "II" to "Afternoon Shift", "III" to "Night Shift" if found.
       - employeeNumber: Look for "Emp. No", "Employee ID", "Operator", or "Inspector ID".
       - operationCode: Look for "Opn Code", "Operation", "Task Code", or "OP-XX".
       - machineNumber: Look for "Machine No.", "Machine ID", "Asset", or "Robot".
       - workOrderNumber: Look for "Work Order No.", "WO#", "Batch ID", or "Order ID".
       - quantityProduced: Look for "Qty. Prod.", "Quantity", "Yield Count", or "Total Units". Extract as an integer.
       - timeTaken: Look for "Time taken (in hrs)", "Duration", "Hours worked", or "Time taken".
    3. If there are multiple rows or tables, extract the details from the first row or the main summary entry.
    4. Be precise. For each field, estimate a confidence score (0.0 to 1.0) based on textual readability, clarity, and handwriting alignment.
       - If the field value is clearly printed, legible, and matches the document perfectly, assign a high confidence score between 0.90 and 1.00. Do not be overly conservative; clear, printed values deserve a score >0.90.
       - Assign moderate confidence scores (0.40 to 0.85) only if the text is handwritten, blurry, faded, partially obscured, or has minor ambiguities.
       - If a field is completely missing or illegible, return a confidence of 0.0 and set the field value to an empty string (or 0 for quantity).
    5. Transcribe all text in the sheet and populate "rawTextTranscription".
  `;

  console.log(`[GEMINI] Sending request (${fileBuffer.length} bytes, ${mimeType})...`);
  const requestStart = Date.now();

  try {
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

    const elapsed = Date.now() - requestStart;
    console.log(`[GEMINI] Response received in ${elapsed}ms`);

    const responseText = result.response.text();
    console.log("RAW GEMINI RESPONSE:", responseText);

    if (!responseText || responseText.trim() === '') {
      throw new Error('Gemini API returned an empty response text.');
    }

    try {
      const parsed = JSON.parse(responseText) as GeminiOcrResult;
      console.log("PARSED JSON:", parsed);
      console.log("EXTRACTED FIELDS:", {
        date: parsed.date,
        shift: parsed.shift,
        employeeNumber: parsed.employeeNumber,
        operationCode: parsed.operationCode,
        machineNumber: parsed.machineNumber,
        workOrderNumber: parsed.workOrderNumber,
        quantityProduced: parsed.quantityProduced,
        timeTaken: parsed.timeTaken,
      });
      return parsed;
    } catch (parseError) {
      console.error('[GEMINI] Failed to parse response JSON:', responseText);
      throw new Error(`Failed to parse Gemini response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
  } catch (error) {
    const elapsed = Date.now() - requestStart;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[GEMINI] API call failed after ${elapsed}ms:`, errorMsg);
    throw error;
  }
}
