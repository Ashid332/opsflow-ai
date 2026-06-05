import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const text = await file.text();
    const fileName = file.name;
    let newOrdersCount = 0;
    const createdOrders: any[] = [];

    if (fileName.endsWith('.json')) {
      const data = JSON.parse(text);
      const ordersToCreate = Array.isArray(data) ? data : [data];

      for (const item of ordersToCreate) {
        if (item.name && item.targetQuantity) {
          const qty = parseInt(item.targetQuantity, 10);
          if (!isNaN(qty) && qty > 0) {
            const order = await prisma.productOrder.create({
              data: {
                name: item.name,
                targetQuantity: qty,
                status: 'PENDING',
              },
            });
            createdOrders.push(order);
            newOrdersCount++;
          }
        }
      }
    } else if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
      const lines = text.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Skip header lines
        if (line.toLowerCase().includes('name') && (line.toLowerCase().includes('target') || line.toLowerCase().includes('quantity'))) {
          continue;
        }

        const parts = line.split(',');
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const targetQty = parseInt(parts[1].trim(), 10);
          if (name && !isNaN(targetQty) && targetQty > 0) {
            const order = await prisma.productOrder.create({
              data: {
                name: name,
                targetQuantity: targetQty,
                status: 'PENDING',
              },
            });
            createdOrders.push(order);
            newOrdersCount++;
          }
        }
      }
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Please upload a .csv or .json file.' }, { status: 400 });
    }

    if (newOrdersCount > 0) {
      await prisma.systemLog.create({
        data: {
          action: 'FILE_IMPORT',
          details: `Imported ${newOrdersCount} orders from file '${fileName}'.`,
          severity: 'INFO',
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${newOrdersCount} orders.`,
      orders: createdOrders,
    });
  } catch (error) {
    console.error('Order import error:', error);
    return NextResponse.json({ error: 'Failed to process file import. Check file formatting.' }, { status: 500 });
  }
}
