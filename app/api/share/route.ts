import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/options'; 
import { ShareLinkService } from '../../../../lib/share/shareLinkService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/share - Create a new share link
export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized: Login required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Validate that user has 2FA enabled before allowing share link creation
    const has2FA = await ShareLinkService.validateShareCreation(userId);
    if (!has2FA) {
      return NextResponse.json(
        { error: '2FA must be enabled to create share links (2FA-1)' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { 
      fileId, 
      password, 
      expiresAt, 
      maxDownloads 
    } = body;

    // Validate required fields
    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId is required' },
        { status: 400 }
      );
    }

    // Validate maxDownloads if provided
    if (maxDownloads !== undefined && (typeof maxDownloads !== 'number' || maxDownloads <= 0)) {
      return NextResponse.json(
        { error: 'maxDownloads must be a positive number if provided' },
        { status: 400 }
      );
    }

    // Validate expiresAt if provided
    if (expiresAt) {
      const parsedExpiresAt = new Date(expiresAt);
      if (isNaN(parsedExpiresAt.getTime())) {
        return NextResponse.json(
          { error: 'expiresAt must be a valid date string' },
          { status: 400 }
        );
      }
      if (parsedExpiresAt <= new Date()) {
        return NextResponse.json(
          { error: 'expiresAt must be a future date' },
          { status: 400 }
        );
      }
    }

    // Create the share link
    const result = await ShareLinkService.createShareLink({
      fileId,
      userId,
      password,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      maxDownloads
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error creating share link:', error);

    if (error.message === 'File not found or unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    if (error.message.includes('2FA must be enabled')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized: Login required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const shareLink = await ShareLinkService.getShareLinkByToken(token);

    if (!shareLink) {
      return NextResponse.json(
        { error: 'Share link not found' },
        { status: 404 }
      );
    }

    if (shareLink.createdBy !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Share link does not belong to user' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      id: shareLink.id,
      token: shareLink.token,
      fileId: shareLink.fileId,
      passwordRequired: !!shareLink.passwordHash,
      expiresAt: shareLink.expiresAt,
      maxDownloads: shareLink.maxDownloads,
      downloadCount: shareLink.downloadCount,
      createdAt: shareLink.createdAt
    });
  } catch (error: any) {
    console.error('Error retrieving share link:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized: Login required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const shareLink = await ShareLinkService.getShareLinkByToken(token);

    if (!shareLink) {
      return NextResponse.json(
        { error: 'Share link not found' },
        { status: 404 }
      );
    }

    if (shareLink.createdBy !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Share link does not belong to user' },
        { status: 403 }
      );
    }

    await prisma.sharedLink.delete({
      where: { token }
    });

    return NextResponse.json({ message: 'Share link deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting share link:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}