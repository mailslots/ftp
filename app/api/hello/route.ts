import { NextResponse } from 'next/server';

type HelloResponse = {
  message: string;
  timestamp: string;
};

export function GET() {
  const payload: HelloResponse = {
    message: 'Hello from Next.js on Vercel! 👋',
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(payload, { status: 200 });
}
