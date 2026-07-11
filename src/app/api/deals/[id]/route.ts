import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Deal ID is required' }, { status: 400 });
    }

    // Delete the deal
    await prisma.deal.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete Deal Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete deal' }, { status: 500 });
  }
}
