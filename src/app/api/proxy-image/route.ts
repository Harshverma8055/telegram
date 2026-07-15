import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing URL', { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/avif,image/jpeg,image/png,image/*,*/*;q=0.8',
        // Spoofing referer sometimes helps bypass hotlink protection
        'Referer': 'https://www.amazon.in/' 
      },
      // Important to not cache on the fetch level if we want fresh proxy, but for images it's fine
      next: { revalidate: 86400 } // Cache for 24 hours
    });

    if (!response.ok) {
      console.error(`Proxy Image Failed: ${response.status} ${response.statusText} for URL: ${url}`);
      return new NextResponse('Failed to fetch image', { status: response.status });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('Content-Type') || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400');
    // Ensure CORS allows our frontend to render it
    headers.set('Access-Control-Allow-Origin', '*');

    return new NextResponse(buffer, {
      status: 200,
      headers
    });
  } catch (error: any) {
    console.error(`Proxy Image Error for ${url}:`, error.message);
    return new NextResponse('Error fetching image', { status: 500 });
  }
}
