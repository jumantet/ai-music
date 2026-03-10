import archiver from 'archiver';
import { Writable, PassThrough } from 'stream';
import { uploadBuffer } from './storage';
import { prisma } from './prisma';

export async function generatePressKit(releaseId: string): Promise<string> {
  const release = await prisma.release.findUniqueOrThrow({
    where: { id: releaseId },
    include: { epkPage: true },
  });

  const chunks: Buffer[] = [];
  const passThrough = new PassThrough();

  const archive = archiver('zip', { zlib: { level: 9 } });

  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    passThrough.on('data', (chunk: Buffer) => chunks.push(chunk));
    passThrough.on('end', () => resolve(Buffer.concat(chunks)));
    passThrough.on('error', reject);
  });

  archive.pipe(passThrough as unknown as Writable);

  // Artist bio
  if (release.epkPage?.bio) {
    archive.append(release.epkPage.bio, { name: 'bio.txt' });
  }

  // Press pitch
  if (release.epkPage?.pressPitch) {
    archive.append(release.epkPage.pressPitch, { name: 'press-release.txt' });
  }

  // Short bio
  if (release.epkPage?.shortBio) {
    archive.append(release.epkPage.shortBio, { name: 'short-bio.txt' });
  }

  // Release description
  if (release.epkPage?.releaseDescription) {
    archive.append(release.epkPage.releaseDescription, { name: 'release-description.txt' });
  }

  // Links file
  const links = [
    `Artist: ${release.artistName}`,
    `Track: ${release.title}`,
    release.coverUrl ? `Cover: ${release.coverUrl}` : null,
    release.trackUrl ? `Track: ${release.trackUrl}` : null,
    release.epkPage?.isPublished
      ? `EPK Page: ${process.env.FRONTEND_URL}/epk/${release.epkPage.slug}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  archive.append(links, { name: 'links.txt' });

  await archive.finalize();
  const zipBuffer = await bufferPromise;

  const key = `press-kits/${releaseId}/press-kit-${Date.now()}.zip`;
  const zipUrl = await uploadBuffer(key, zipBuffer, 'application/zip');

  return zipUrl;
}
