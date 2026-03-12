const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export interface MetaCampaignResult {
  campaignId: string;
  adSetId: string;
  adId: string;
  campaignUrl: string;
}

interface MetaApiResponse {
  id?: string;
  error?: { message: string; code: number };
}

async function metaPost(
  path: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<MetaApiResponse> {
  const params = new URLSearchParams();
  params.set('access_token', accessToken);
  for (const [key, value] of Object.entries(body)) {
    params.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  }

  const response = await fetch(`${META_API_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = (await response.json()) as MetaApiResponse;
  if (data.error) {
    throw new Error(`Meta API error (${data.error.code}): ${data.error.message}`);
  }
  return data;
}

export interface CreateCampaignOptions {
  accessToken: string;
  adAccountId: string;
  campaignName: string;
  dailyBudgetCents: number;
  durationDays: number;
  videoUrl: string;
  imageUrl?: string;
  message: string;
  pageId: string;
  instagramActorId?: string;
}

export async function createMetaAdCampaign(
  opts: CreateCampaignOptions
): Promise<MetaCampaignResult> {
  const accountId = opts.adAccountId.startsWith('act_')
    ? opts.adAccountId
    : `act_${opts.adAccountId}`;

  // 1. Create Campaign
  const campaign = await metaPost(`${accountId}/campaigns`, opts.accessToken, {
    name: opts.campaignName,
    objective: 'VIDEO_VIEWS',
    status: 'PAUSED',
    special_ad_categories: [],
  });
  const campaignId = campaign.id!;

  // 2. Create Ad Set
  const startTime = Math.floor(Date.now() / 1000);
  const endTime = startTime + opts.durationDays * 86400;

  const adSet = await metaPost(`${accountId}/adsets`, opts.accessToken, {
    name: `${opts.campaignName} – Ad Set`,
    campaign_id: campaignId,
    billing_event: 'THRUPLAY',
    optimization_goal: 'THRUPLAY',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    daily_budget: opts.dailyBudgetCents,
    targeting: {
      age_min: 18,
      age_max: 35,
      publisher_platforms: ['instagram'],
      instagram_positions: ['stream', 'story', 'reels'],
    },
    start_time: startTime,
    end_time: endTime,
    status: 'PAUSED',
  });
  const adSetId = adSet.id!;

  // 3. Create Ad Creative
  const videoData: Record<string, unknown> = {
    video_url: opts.videoUrl,
    message: opts.message,
    call_to_action: { type: 'LISTEN_NOW' },
  };
  if (opts.imageUrl) {
    videoData.image_url = opts.imageUrl;
  }

  const creative = await metaPost(`${accountId}/adcreatives`, opts.accessToken, {
    name: `${opts.campaignName} – Creative`,
    object_story_spec: {
      page_id: opts.pageId,
      ...(opts.instagramActorId ? { instagram_actor_id: opts.instagramActorId } : {}),
      video_data: videoData,
    },
  });
  const creativeId = creative.id!;

  // 4. Create Ad
  const ad = await metaPost(`${accountId}/ads`, opts.accessToken, {
    name: `${opts.campaignName} – Ad`,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: 'PAUSED',
  });
  const adId = ad.id!;

  return {
    campaignId,
    adSetId,
    adId,
    campaignUrl: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${opts.adAccountId}&selected_campaign_ids=${campaignId}`,
  };
}

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  account_status: number;
}

export async function getMetaAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const response = await fetch(
    `${META_API_BASE}/me/adaccounts?fields=id,name,currency,account_status&access_token=${accessToken}`
  );
  const data = (await response.json()) as { data?: MetaAdAccount[]; error?: { message: string } };
  if (data.error) throw new Error(`Meta API error: ${data.error.message}`);
  return data.data ?? [];
}

export interface MetaPage {
  id: string;
  name: string;
  instagram_business_account?: { id: string };
}

export async function getMetaPages(accessToken: string): Promise<MetaPage[]> {
  const response = await fetch(
    `${META_API_BASE}/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`
  );
  const data = (await response.json()) as { data?: MetaPage[]; error?: { message: string } };
  if (data.error) throw new Error(`Meta API error: ${data.error.message}`);
  return data.data ?? [];
}
