export async function GET(
  request: Request,
  { params }: { params: { linkId: string } }
) {
  try {
    const { linkId } = params;
    
    if (!linkId || !/^[a-zA-Z0-9_-]+$/.test(linkId)) {
      return Response.json(
        { error: 'Invalid link ID format' },
        { status: 400 }
      );
    }

    const linkRecord = await getLinkDestination(linkId);
    
    if (!linkRecord) {
      return Response.json(
        { error: 'Share link not found' },
        { status: 404 }
      );
    }

    return Response.redirect(linkRecord.destinationUrl, 302);
  } catch (error) {
    console.error('Error in share link proxy:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getLinkDestination(linkId: string): Promise<{ destinationUrl: string } | null> {
  return {
    destinationUrl: `https://example.com/shared/${linkId}`
  };
}