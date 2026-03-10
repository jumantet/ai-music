import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface EPKContent {
  bio: string;
  pressPitch: string;
  shortBio: string;
  releaseDescription: string;
}

export interface ReleaseContext {
  artistName: string;
  title: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  city?: string;
  influences?: string;
  shortBio?: string;
}

export async function generateEPKContent(ctx: ReleaseContext): Promise<EPKContent> {
  const prompt = buildEPKPrompt(ctx);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert music publicist who crafts compelling press materials for independent artists. Write in an engaging, professional tone that resonates with music journalists, bloggers, and radio hosts. Return ONLY valid JSON.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.8,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  const parsed = JSON.parse(content) as EPKContent;
  return parsed;
}

function buildEPKPrompt(ctx: ReleaseContext): string {
  const parts = [
    `Artist: ${ctx.artistName}`,
    `Track/Release: ${ctx.title}`,
    ctx.genre ? `Genre: ${ctx.genre}` : null,
    ctx.mood ? `Mood: ${ctx.mood}` : null,
    ctx.bpm ? `BPM: ${ctx.bpm}` : null,
    ctx.city ? `Based in: ${ctx.city}` : null,
    ctx.influences ? `Influences: ${ctx.influences}` : null,
    ctx.shortBio ? `Short bio provided by artist: ${ctx.shortBio}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `Generate professional EPK content for the following artist and release:

${parts}

Return a JSON object with these exact keys:
{
  "bio": "Full artist bio (2-3 paragraphs, ~150-200 words). Blend the artist's sound, influences, geographic context, and artistic vision. Make it vivid and compelling for press.",
  "pressPitch": "Press pitch for blogs and radio (2-3 paragraphs, ~100-150 words). Lead with a strong hook, describe the track's sound and emotional feel, and explain why it's relevant to the outlet's audience.",
  "shortBio": "One-sentence artist bio suitable for Spotify, social media, and festival applications. Max 30 words.",
  "releaseDescription": "Track description for Bandcamp, Spotify pitch, and newsletters (1-2 paragraphs, ~80-120 words). Focus on the listening experience and production details."
}`;
}

export interface OutreachEmailContent {
  subject: string;
  body: string;
}

export type OutreachContactType = 'BLOG' | 'RADIO' | 'PLAYLIST' | 'JOURNALIST';

export async function generateOutreachEmail(
  ctx: ReleaseContext,
  contactType: OutreachContactType,
  contactName?: string
): Promise<OutreachEmailContent> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert music publicist writing personalized outreach emails. Write concise, genuine emails that feel personal — not spammy. Return ONLY valid JSON.',
      },
      {
        role: 'user',
        content: buildOutreachPrompt(ctx, contactType, contactName),
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.75,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  return JSON.parse(content) as OutreachEmailContent;
}

function buildOutreachPrompt(
  ctx: ReleaseContext,
  contactType: OutreachContactType,
  contactName?: string
): string {
  const contextLines = [
    `Artist: ${ctx.artistName}`,
    `Track: ${ctx.title}`,
    ctx.genre ? `Genre: ${ctx.genre}` : null,
    ctx.mood ? `Mood: ${ctx.mood}` : null,
    ctx.city ? `Based in: ${ctx.city}` : null,
    ctx.influences ? `Influences: ${ctx.influences}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const recipientTypeMap: Record<OutreachContactType, string> = {
    BLOG: 'music blogger/journalist',
    RADIO: 'radio station/DJ',
    PLAYLIST: 'playlist curator',
    JOURNALIST: 'music journalist',
  };

  const recipientDesc = recipientTypeMap[contactType];
  const greeting = contactName ? `Hi ${contactName}` : 'Hi';

  return `Write a personalized outreach email from ${ctx.artistName} to a ${recipientDesc}.

Artist/Release info:
${contextLines}

The email should:
- Start with "${greeting},"
- Have a compelling, non-clickbait subject line
- Be concise (3-4 short paragraphs max)
- Feel genuine and respectful of their time
- Include a clear ask appropriate for a ${recipientDesc}
- End with a professional sign-off

Return JSON:
{
  "subject": "Email subject line",
  "body": "Full email body (use \\n for line breaks)"
}`;
}
