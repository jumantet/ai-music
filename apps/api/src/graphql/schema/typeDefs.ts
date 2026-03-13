export const typeDefs = `#graphql
  scalar Upload

  enum Plan {
    FREE
    PRO
  }

  enum CampaignStatus {
    DRAFT
    GENERATING
    READY
    LAUNCHED
  }

  type User {
    id: ID!
    email: String!
    name: String!
    plan: Plan!
    emailVerified: Boolean!
    metaAdAccountId: String
    metaConnected: Boolean!
    createdAt: String!
    campaigns: [Campaign!]!
  }

  type Campaign {
    id: ID!
    userId: ID!
    trackTitle: String!
    artistName: String!
    trackS3Key: String
    trackUrl: String
    hookStart: Float
    hookEnd: Float
    mood: String
    customVideoS3Key: String
    customVideoUrl: String
    status: CampaignStatus!
    metaCampaignId: String
    generatedAds: [GeneratedAd!]!
    createdAt: String!
  }

  type GeneratedAd {
    id: ID!
    campaignId: ID!
    videoS3Key: String
    videoUrl: String
    visualStyle: String!
    textOverlay: String
    metaAdId: String
    createdAt: String!
  }

  type HookSuggestion {
    start: Float!
    end: Float!
    label: String!
    energy: String!
  }

  type PexelsVideo {
    id: ID!
    url: String!
    thumbnailUrl: String!
    previewUrl: String!
    duration: Int!
    width: Int!
    height: Int!
    photographer: String!
    photographerUrl: String!
  }

  type MetaAdAccount {
    id: ID!
    name: String!
    currency: String!
  }

  type MetaPage {
    id: ID!
    name: String!
    instagramActorId: String
  }

  type MetaAdCampaignResult {
    campaignId: String!
    adSetId: String!
    adId: String!
    campaignUrl: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type UploadUrlPayload {
    uploadUrl: String!
    fileUrl: String!
    key: String!
  }

  type Query {
    me: User!
    campaign(id: ID!): Campaign!
    campaigns: [Campaign!]!
    suggestHooks(campaignId: ID!): [HookSuggestion!]!
    searchVideosForMood(mood: String!): [PexelsVideo!]!
    metaAdAccounts: [MetaAdAccount!]!
    metaPages: [MetaPage!]!
  }

  type Mutation {
    signup(email: String!, password: String!, name: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    verifyEmail(token: String!): AuthPayload!
    resendVerificationEmail: Boolean!

    createCampaign(trackTitle: String!, artistName: String!): Campaign!
    updateCampaign(
      id: ID!
      hookStart: Float
      hookEnd: Float
      mood: String
      trackS3Key: String
      customVideoS3Key: String
    ): Campaign!
    deleteCampaign(id: ID!): Boolean!
    generateAds(campaignId: ID!): Campaign!

    getUploadUrl(campaignId: ID!, fileType: String!, contentType: String!): UploadUrlPayload!

    createStripeCheckout: String!
    createStripePortal: String!

    connectMeta(accessToken: String!, adAccountId: String!): User!
    disconnectMeta: User!
    launchMetaAd(
      campaignId: ID!
      adId: ID!
      pageId: String!
      instagramActorId: String
      campaignName: String!
      dailyBudgetCents: Int!
      durationDays: Int!
      message: String!
    ): MetaAdCampaignResult!
  }
`;
