export type Plan = 'FREE' | 'PRO';

export type CampaignStatus = 'DRAFT' | 'GENERATING' | 'READY' | 'LAUNCHED';

export interface EditorSettings {
  filterPreset?: string;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  grain?: number;
  motionPreset?: string;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  textBgColor?: string;
  textBgOpacity?: number;
  textPosition?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  emailVerified: boolean;
  metaConnected?: boolean;
  metaAdAccountId?: string;
  spotifyArtistId?: string;
  spotifyArtistName?: string;
  createdAt: string;
  campaigns: Campaign[];
}

export interface Campaign {
  id: string;
  userId: string;
  trackTitle: string;
  artistName: string;
  spotifyTrackId?: string;
  trackS3Key?: string;
  trackUrl?: string;
  hookStart?: number;
  hookEnd?: number;
  videoS3Key?: string;
  videoUrl?: string;
  editorSettings?: EditorSettings;
  status: CampaignStatus;
  generatedAd?: GeneratedAd;
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
