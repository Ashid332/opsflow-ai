import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const severity = searchParams.get('severity') || '';
    const action = searchParams.get('action') || '';

    // Build filter object
    const where: any = {};

    if (search) {
      where.OR = [
        { details: { contains: search } },
        { action: { contains: search } }
      ];
    }

    if (severity && severity !== 'ALL') {
      where.severity = severity;
    }

    if (action && action !== 'ALL') {
      where.action = action;
    }

    const logs = await prisma.systemLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 100, // Fetch up to 100 recent entries
    });

    // Get list of distinct actions for filter dropdown
    const distinctActions = await prisma.systemLog.findMany({
      select: { action: true },
      distinct: ['action'],
    });

    const actions = distinctActions.map(a => a.action);

    return NextResponse.json({
      logs,
      actions,
    });
  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
