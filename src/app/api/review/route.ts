import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const inspections = await prisma.qualityInspection.findMany({
      include: {
        order: true,
      },
      orderBy: [
        { status: 'asc' }, // PENDING starts with P, APPROVED with A, REJECTED with R. Wait, let's sort PENDING first.
        { createdAt: 'desc' },
      ],
    });

    // Custom sorting to make PENDING first
    const sorted = [...inspections].sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return 0;
    });

    return NextResponse.json(sorted);
  } catch (error) {
    console.error('Failed to fetch inspections:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
