import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  console.log('[DEBUG-DB] Testing database connection...');
  try {
    const machineCount = await prisma.machine.count();
    console.log('[DEBUG-DB] Database connection verified. Machine count:', machineCount);
    return NextResponse.json({
      success: true,
      message: 'Database connectivity verified successfully.',
      machineCount: machineCount,
      databaseUrlPrefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) : 'none'
    });
  } catch (error: any) {
    console.error('[DEBUG-DB] Database test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message || String(error),
      stack: error.stack,
      databaseUrlPrefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) : 'none'
    }, { status: 500 });
  }
}
