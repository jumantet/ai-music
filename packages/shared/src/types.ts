export type Plan = 'FREE' | 'PRO';

export type CampaignStatus = 'DRAFT' | 'GENERATING' | 'READY' | 'LAUNCHED';

export type AdMood =
  | 'dreamy'
  | 'night_drive'
  | 'indie'
  | 'psychedelic'
  | 'vintage'
  | 'urban';

export interface User {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  emailVerified: boolean;
  metaConnected?: boolean;
  metaAdAccountId?: string;
  createdAt: string;
  campaigns: Campaign[];
}

export interface Campaign {
  id: string;
  userId: string;
  trackTitle: string;
  artistName: string;
  trackS3Key?: string;
  trackUrl?: string;
  hookStart?: number;
  hookEnd?: number;
  mood?: AdMood;
  status: CampaignStatus;
  generatedAds: GeneratedAd[];
  metaCampaignId?: string;
  createdAt: string;
}

export interface HookSuggestion {
  start: number;
  end: number;
  label: string;
  energy: 'high' | 'chorus' | 'build';
}

export interface GeneratedAd {
  id: string;
  campaignId: string;
  videoS3Key?: string;
  videoUrl?: string;
  visualStyle: string;
  textOverlay?: string;
  metaAdId?: string;
  createdAt: string;
}

export interface PexelsVideo {
  id: string;
  url: string;
  thumbnailUrl: string;
  previewUrl: string;
  duration: number;
  width: number;
  height: number;
  photographer: string;
  photographerUrl: string;
}
