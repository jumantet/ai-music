import { gql } from '@apollo/client';

export const VERIFY_EMAIL_MUTATION = gql`
  mutation VerifyEmail($token: String!) {
    verifyEmail(token: $token) {
      token
      user {
        id
        email
        name
        plan
        emailVerified
        spotifyArtistId
        spotifyArtistName
      }
    }
  }
`;

export const RESEND_VERIFICATION_MUTATION = gql`
  mutation ResendVerificationEmail {
    resendVerificationEmail
  }
`;

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        email
        name
        plan
        emailVerified
        spotifyArtistId
        spotifyArtistName
      }
    }
  }
`;

export const SIGNUP_MUTATION = gql`
  mutation Signup($email: String!, $password: String!) {
    signup(email: $email, password: $password) {
      token
      user {
        id
        email
        name
        plan
        emailVerified
        spotifyArtistId
        spotifyArtistName
      }
    }
  }
`;

export const CREATE_CAMPAIGN_MUTATION = gql`
  mutation CreateCampaign($trackTitle: String!, $artistName: String!, $spotifyTrackId: String) {
    createCampaign(trackTitle: $trackTitle, artistName: $artistName, spotifyTrackId: $spotifyTrackId) {
      id
      trackTitle
      artistName
      spotifyTrackId
      status
      createdAt
    }
  }
`;

export const UPDATE_CAMPAIGN_MUTATION = gql`
  mutation UpdateCampaign(
    $id: ID!
    $hookStart: Float
    $hookEnd: Float
    $trackS3Key: String
    $spotifyTrackId: String
    $videoS3Key: String
    $videoUrl: String
    $editorSettings: EditorSettingsInput
  ) {
    updateCampaign(
      id: $id
      hookStart: $hookStart
      hookEnd: $hookEnd
      trackS3Key: $trackS3Key
      spotifyTrackId: $spotifyTrackId
      videoS3Key: $videoS3Key
      videoUrl: $videoUrl
      editorSettings: $editorSettings
    ) {
      id
      hookStart
      hookEnd
      videoS3Key
      videoUrl
      editorSettings {
        filterPreset
        brightness
        contrast
        saturation
        grain
        motionPreset
        text
        fontFamily
        fontSize
        fontColor
        textBgColor
        textBgOpacity
        textPosition
      }
      status
    }
  }
`;

export const GENERATE_ADS_MUTATION = gql`
  mutation GenerateAds($campaignId: ID!) {
    generateAds(campaignId: $campaignId) {
      id
      status
      generatedAd {
        id
        videoUrl
      }
    }
  }
`;

export const DELETE_CAMPAIGN_MUTATION = gql`
  mutation DeleteCampaign($id: ID!) {
    deleteCampaign(id: $id)
  }
`;

export const GET_UPLOAD_URL_MUTATION = gql`
  mutation GetUploadUrl($campaignId: ID!, $fileType: String!, $contentType: String!) {
    getUploadUrl(campaignId: $campaignId, fileType: $fileType, contentType: $contentType) {
      uploadUrl
      fileUrl
      key
    }
  }
`;

export const CONNECT_META_MUTATION = gql`
  mutation ConnectMeta($accessToken: String!, $adAccountId: String!) {
    connectMeta(accessToken: $accessToken, adAccountId: $adAccountId) {
      id
      metaConnected
      metaAdAccountId
    }
  }
`;

export const DISCONNECT_META_MUTATION = gql`
  mutation DisconnectMeta {
    disconnectMeta {
      id
      metaConnected
      metaAdAccountId
    }
  }
`;

export const LINK_SPOTIFY_ARTIST_MUTATION = gql`
  mutation LinkSpotifyArtist($spotifyArtistId: String!, $spotifyArtistName: String!) {
    linkSpotifyArtist(spotifyArtistId: $spotifyArtistId, spotifyArtistName: $spotifyArtistName) {
      id
      spotifyArtistId
      spotifyArtistName
    }
  }
`;

export const UNLINK_SPOTIFY_ARTIST_MUTATION = gql`
  mutation UnlinkSpotifyArtist {
    unlinkSpotifyArtist {
      id
      spotifyArtistId
      spotifyArtistName
    }
  }
`;

export const SYNC_MY_CATALOG_TRACKS_MUTATION = gql`
  mutation SyncMyCatalogTracks {
    syncMyCatalogTracks
  }
`;

export const LAUNCH_META_AD_MUTATION = gql`
  mutation LaunchMetaAd(
    $campaignId: ID!
    $adId: ID!
    $pageId: String!
    $instagramActorId: String
    $campaignName: String!
    $dailyBudgetCents: Int!
    $durationDays: Int!
    $message: String!
  ) {
    launchMetaAd(
      campaignId: $campaignId
      adId: $adId
      pageId: $pageId
      instagramActorId: $instagramActorId
      campaignName: $campaignName
      dailyBudgetCents: $dailyBudgetCents
      durationDays: $durationDays
      message: $message
    ) {
      campaignId
      adSetId
      adId
      campaignUrl
    }
  }
`;

export const CREATE_STRIPE_CHECKOUT_MUTATION = gql`
  mutation CreateStripeCheckout {
    createStripeCheckout
  }
`;

export const CREATE_STRIPE_PORTAL_MUTATION = gql`
  mutation CreateStripePortal {
    createStripePortal
  }
`;
