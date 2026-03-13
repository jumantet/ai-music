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
      }
    }
  }
`;

export const SIGNUP_MUTATION = gql`
  mutation Signup($email: String!, $password: String!, $name: String!) {
    signup(email: $email, password: $password, name: $name) {
      token
      user {
        id
        email
        name
        plan
        emailVerified
      }
    }
  }
`;

export const CREATE_CAMPAIGN_MUTATION = gql`
  mutation CreateCampaign($trackTitle: String!, $artistName: String!) {
    createCampaign(trackTitle: $trackTitle, artistName: $artistName) {
      id
      trackTitle
      artistName
      status
      createdAt
    }
  }
`;

export const UPDATE_CAMPAIGN_MUTATION = gql`
  mutation UpdateCampaign($id: ID!, $hookStart: Float, $hookEnd: Float, $mood: String, $trackS3Key: String) {
    updateCampaign(id: $id, hookStart: $hookStart, hookEnd: $hookEnd, mood: $mood, trackS3Key: $trackS3Key) {
      id
      hookStart
      hookEnd
      mood
      status
    }
  }
`;

export const GENERATE_ADS_MUTATION = gql`
  mutation GenerateAds($campaignId: ID!) {
    generateAds(campaignId: $campaignId) {
      id
      status
      generatedAds {
        id
        videoUrl
        visualStyle
        textOverlay
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
