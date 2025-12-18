import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json(
      { error: 'Latitude and longitude are required' },
      { status: 400 }
    );
  }

  if (isNaN(Number(lat)) || isNaN(Number(lon))) {
    return NextResponse.json(
      { error: 'Invalid latitude or longitude values' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'MDRRMO-Bulan-App (https://github.com/joloLG/MDRRMO-System)',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://mdrrmo-bulan.com'
        },
        next: { revalidate: 3600 }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Nominatim API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('Geocoding successful:', {
      lat,
      lon,
      display_name: data.display_name,
      address: data.address
    });
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in geocoding API:', error);
    
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error instanceof Error ? error.message : 'Unknown error occurred'
      : 'Failed to fetch location data';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}
