import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  const apiKeyExists = !!apiKey;
  const apiKeyLength = apiKey ? apiKey.length : 0;
  const apiKeyPrefix = apiKey ? apiKey.substring(0, 10) : 'none';

  console.log(`[DEBUG-GEMINI] Checking GEMINI_API_KEY presence: ${apiKeyExists}, Length: ${apiKeyLength}`);

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your-google-gemini-api-key-here') {
    return NextResponse.json({
      success: false,
      error: 'GEMINI_API_KEY is not set or contains the default placeholder.',
      envDetails: {
        exists: apiKeyExists,
        length: apiKeyLength,
        prefix: apiKeyPrefix
      }
    }, { status: 500 });
  }

  try {
    console.log('[DEBUG-GEMINI] Initializing GoogleGenerativeAI...');
    const genAI = new GoogleGenerativeAI(apiKey);
    
    console.log('[DEBUG-GEMINI] Requesting gemini-2.5-flash text content generation...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Respond with exactly: "GEMINI API OK"' }] }]
    });

    console.log('[DEBUG-GEMINI] Response received successfully!');
    const responseText = result.response.text();

    return NextResponse.json({
      success: true,
      message: 'Gemini connectivity verified successfully.',
      responseText: responseText,
      envDetails: {
        exists: apiKeyExists,
        length: apiKeyLength,
        prefix: apiKeyPrefix
      }
    });
  } catch (error: any) {
    console.error('[DEBUG-GEMINI] Error occurred during test:', error);
    return NextResponse.json({
      success: false,
      error: error.message || String(error),
      stack: error.stack,
      envDetails: {
        exists: apiKeyExists,
        length: apiKeyLength,
        prefix: apiKeyPrefix
      }
    }, { status: 500 });
  }
}
