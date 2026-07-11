import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const posts = await prisma.recurringPost.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ posts });
  } catch (error: any) {
    console.error('Failed to get recurring posts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, content, imageUrl, link, intervalMin } = body;

    if (!title || !content || !intervalMin) {
      return NextResponse.json({ error: 'Title, Content and Interval are required' }, { status: 400 });
    }

    const post = await prisma.recurringPost.create({
      data: {
        title,
        content,
        imageUrl: imageUrl || null,
        link: link || null,
        intervalMin: Number(intervalMin),
        isActive: true,
      }
    });

    return NextResponse.json({ success: true, post });
  } catch (error: any) {
    console.error('Failed to create recurring post:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, isActive, intervalMin } = body;

    if (!id) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    const updatedData: any = {};
    if (isActive !== undefined) updatedData.isActive = isActive;
    if (intervalMin !== undefined) updatedData.intervalMin = Number(intervalMin);

    const post = await prisma.recurringPost.update({
      where: { id },
      data: updatedData
    });

    return NextResponse.json({ success: true, post });
  } catch (error: any) {
    console.error('Failed to update recurring post:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Post ID is required in URL parameter' }, { status: 400 });
    }

    await prisma.recurringPost.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete recurring post:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
