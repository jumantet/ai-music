export type Plan = 'FREE' | 'PRO';

export type ContactType = 'BLOG' | 'RADIO' | 'PLAYLIST' | 'JOURNALIST';

export type OutreachStatus =
  | 'NOT_CONTACTED'
  | 'SENT'
  | 'REPLIED'
  | 'FEATURED';

export interface User {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  createdAt: string;
}

export interface Release {
  id: string;
  userId: string;
  title: string;
  artistName: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  trackUrl?: string;
  coverUrl?: string;
  city?: string;
  influences?: string;
  shortBio?: string;
  epkPage?: EPKPage;
  pressKit?: PressKit;
  createdAt: string;
}

export interface EPKPage {
  id: string;
  releaseId: string;
  slug: string;
  bio?: string;
  pressPitch?: string;
  shortBio?: string;
  releaseDescription?: string;
  isPublished: boolean;
  release?: Release;
}

export interface PressKit {
  id: string;
  releaseId: string;
  zipUrl: string;
  generatedAt: string;
}

export interface Contact {
  id: string;
  userId: string;
  name: string;
  email: string;
  type: ContactType;
  website?: string;
  notes?: string;
  createdAt: string;
}

export interface Outreach {
  id: string;
  contactId: string;
  releaseId: string;
  subject: string;
  body: string;
  status: OutreachStatus;
  sentAt?: string;
  repliedAt?: string;
  contact?: Contact;
  release?: Release;
  createdAt: string;
}
