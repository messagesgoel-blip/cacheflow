import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = session.user.id;

    const vault = await prisma.vault.findUnique({
      where: { userId },
      select: { isEnabled: true, createdAt: true, updatedAt: true }
    });

    if (!vault) {
      return new Response(JSON.stringify({ isEnabled: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(vault), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching vault status:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = session.user.id;
    const { isEnabled } = await request.json();

    if (typeof isEnabled !== 'boolean') {
      return new Response(JSON.stringify({ error: 'Invalid request body: isEnabled must be boolean' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Upsert the vault record - create if doesn't exist, update if exists
    const vault = await prisma.vault.upsert({
      where: { userId },
      update: { 
        isEnabled,
        updatedAt: new Date()
      },
      create: { 
        id: `vault_${Date.now()}`, // Generate a unique ID
        userId,
        isEnabled,
        encryptedData: '{}' // Default empty encrypted data
      },
    });

    return new Response(JSON.stringify({ 
      success: true, 
      isEnabled: vault.isEnabled 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating vault status:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}