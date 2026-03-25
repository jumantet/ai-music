import { gql } from '@apollo/client';

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      name
      plan
      emailVerified
      metaConnected
      metaAdAccountId
      createdAt
      campaigns {
        id
        trackTitle
        artistName
        trackUrl
        mood
        status
        hookStart
        hookEnd
        metaCampaignId
        createdAt
        generatedAds {
          id
          videoUrl
          visualStyle
          textOverlay
          metaAdId
        }
      }
    }
  }
`;

export const CAMPAIGN_QUERY = gql`
  query Campaign($id: ID!) {
    campaign(id: $id) {
      id
      trackTitle
      artistName
      trackUrl
      trackS3Key
      mood
      status
      hookStart
      hookEnd
      customVideoUrl
      metaCampaignId
      createdAt
      generatedAds {
        id
        videoUrl
        visualStyle
        textOverlay
        metaAdId
        createdAt
      }
    }
  }
`;

export const SUGGEST_HOOKS_QUERY = gql`
  query SuggestHooks($campaignId: ID!) {
    suggestHooks(campaignId: $campaignId) {
      start
      end
      label
      energy
    }
  }
`;

export const SUGGEST_MOOD_QUERY = gql`
  query SuggestMood($campaignId: ID!) {
    suggestMood(campaignId: $campaignId) {
      moods {
        key
        label
        videoKeywords
        icon
      }
    }
  }
`;

export const SEARCH_VIDEOS_FOR_MOOD_QUERY = gql`
  query SearchVideosForMood($mood: String!, $page: Int, $keywords: [String!]) {
    searchVideosForMood(mood: $mood, page: $page, keywords: $keywords) {
      videos {
        id
        url
        thumbnailUrl
        previewUrl
        duration
        width
        height
        photographer
        photographerUrl
      }
      totalResults
      page
      perPage
    }
  }
`;

export const META_AD_ACCOUNTS_QUERY = gql`
  query MetaAdAccounts {
    metaAdAccounts {
      id
      name
      currency
    }
  }
`;

export const META_PAGES_QUERY = gql`
  query MetaPages {
    metaPages {
      id
      name
      instagramActorId
    }
  }
`;
