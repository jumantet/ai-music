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
    videoCredits: Int!
    metaAdAccountId: String
    metaConnected: Boolean!
    spotifyArtistId: String
    spotifyArtistName: String
    createdAt: String!
    campaigns: [Campaign!]!
  }

  type SpotifyArtist {
    id: ID!
    name: String!
    imageUrl: String
  }

  type SpotifyTrack {
    id: ID!
    name: String!
    artistName: String!
    albumName: String!
    albumImageUrl: String
    durationMs: Int!
  }

  """Métadonnées (titre, pochette…) depuis un lien streaming — pas le fichier audio."""
  type StreamingTrackMetadata {
    source: String!
    spotifyTrackId: String
    externalId: String
    name: String!
    artistName: String!
    albumName: String!
    albumImageUrl: String
    durationMs: Int!
  }

  """Morceau persisté (sync Spotify) pour l’utilisateur connecté."""
  type CatalogTrack {
    id: ID!
    spotifyTrackId: String!
    name: String!
    artistName: String!
    albumName: String!
    albumImageUrl: String
    durationMs: Int!
  }

  type EditorSettings {
    filterPreset: String
    brightness: Int
    contrast: Int
    saturation: Int
    grain: Int
    motionPreset: String
    text: String
    fontFamily: String
    fontSize: Int
    fontColor: String
    textBgColor: String
    textBgOpacity: Float
    textPosition: String
    endCardEnabled: Boolean
    endCardDurationSec: Float
    endCardTitle: String
    endCardShowTitle: Boolean
    endCardCoverUrl: String
  }

  type Campaign {
    id: ID!
    userId: ID
    sessionId: String
    trackTitle: String!
    artistName: String!
    spotifyTrackId: String
    trackS3Key: String
    trackUrl: String
    hookStart: Float
    hookEnd: Float
    videoS3Key: String
    videoUrl: String
    editorSettings: EditorSettings
    status: CampaignStatus!
    metaCampaignId: String
    generatedAd: GeneratedAd
    createdAt: String!
  }

  type GeneratedAd {
    id: ID!
    campaignId: ID!
    videoS3Key: String
    videoUrl: String
    metaAdId: String
    createdAt: String!
  }

  type HookSuggestion {
    start: Float!
    end: Float!
    label: String!
    energy: String!
  }

  type MoodOption {
    key: String!
    label: String!
    videoKeywords: [String!]!
    icon: String!
  }

  type MoodSuggestion {
    moods: [MoodOption!]!
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

  type PexelsVideosPage {
    videos: [PexelsVideo!]!
    totalResults: Int!
    page: Int!
    perPage: Int!
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

  input EditorSettingsInput {
    filterPreset: String
    brightness: Int
    contrast: Int
    saturation: Int
    grain: Int
    motionPreset: String
    text: String
    fontFamily: String
    fontSize: Int
    fontColor: String
    textBgColor: String
    textBgOpacity: Float
    textPosition: String
    endCardEnabled: Boolean
    endCardDurationSec: Float
    endCardTitle: String
    endCardShowTitle: Boolean
    endCardCoverUrl: String
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
    """Segments suggérés ; optionnellement guidés par la courbe RMS client (Web Audio)."""
    suggestHooks(
      campaignId: ID!
      audioDurationSec: Float
      audioEnergyEnvelope: [Float!]
    ): [HookSuggestion!]!
    """Ambiances visuelles (plusieurs propositions) ; optionnellement biaisées par la courbe RMS client (Web Audio)."""
    suggestMood(
      campaignId: ID!
      audioDurationSec: Float
      audioEnergyEnvelope: [Float!]
    ): MoodSuggestion!
    searchVideosForMood(mood: String!, page: Int, keywords: [String!]): PexelsVideosPage!
    """Recherche libre de clips portrait par mots-clés (texte saisi par l'utilisateur)."""
    searchPexelsVideos(query: String!, page: Int): PexelsVideosPage!
    metaAdAccounts: [MetaAdAccount!]!
    metaPages: [MetaPage!]!

    spotifySearchArtists(query: String!): [SpotifyArtist!]!
    # Recherche catalogue Spotify sans session (ex. avant login). Limite côté serveur.
    spotifySearchArtistsPublic(query: String!): [SpotifyArtist!]!
    spotifyArtistTracks(artistId: ID!, limit: Int): [SpotifyTrack!]!
    """Métadonnées d’un morceau à partir d’une URL open.spotify.com, d’une URI ou d’un ID."""
    spotifyTrackFromUrl(url: String!): SpotifyTrack
    """Lien Spotify, YouTube, SoundCloud ou Apple Music → titre, artiste, pochette (audio = upload séparé)."""
    streamingTrackFromUrl(url: String!): StreamingTrackMetadata
    myCatalogTracks: [CatalogTrack!]!
  }

  type Mutation {
    signup(email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    verifyEmail(token: String!): AuthPayload!
    resendVerificationEmail: Boolean!

    createCampaign(trackTitle: String!, artistName: String!, spotifyTrackId: String): Campaign!
    updateCampaign(
      id: ID!
      hookStart: Float
      hookEnd: Float
      trackS3Key: String
      spotifyTrackId: String
      videoS3Key: String
      videoUrl: String
      editorSettings: EditorSettingsInput
    ): Campaign!
    deleteCampaign(id: ID!): Boolean!
    """Consomme 1 crédit vidéo ; rattache un brouillon anonyme (session) au compte si besoin."""
    generateAds(campaignId: ID!): Campaign!

    getUploadUrl(campaignId: ID!, fileType: String!, contentType: String!): UploadUrlPayload!

    createStripeCheckout: String!
    createStripePortal: String!

    connectMeta(accessToken: String!, adAccountId: String!): User!
    disconnectMeta: User!

    """Lie la page artiste Spotify (ID catalogue public) au compte utilisateur."""
    linkSpotifyArtist(spotifyArtistId: String!, spotifyArtistName: String!): User!
    unlinkSpotifyArtist: User!
    """Resynchronise les titres depuis Spotify pour l’artiste lié (remplace la table Track)."""
    syncMyCatalogTracks: Int!
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
