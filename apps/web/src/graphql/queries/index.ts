import { gql } from '@apollo/client';

const EDITOR_SETTINGS_FRAGMENT = `
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
    endCardEnabled
    endCardDurationSec
    endCardTitle
    endCardShowTitle
    endCardCoverUrl
  }
`;

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      name
      plan
      emailVerified
      videoCredits
      metaConnected
      metaAdAccountId
      spotifyArtistId
      spotifyArtistName
      createdAt
      campaigns {
        id
        trackTitle
        artistName
        trackUrl
        status
        hookStart
        hookEnd
        videoUrl
        metaCampaignId
        createdAt
        generatedAd {
          id
          videoUrl
          metaAdId
        }
      }
    }
  }
`;

export const SPOTIFY_SEARCH_ARTISTS_PUBLIC_QUERY = gql`
  query SpotifySearchArtistsPublic($query: String!) {
    spotifySearchArtistsPublic(query: $query) {
      id
      name
      imageUrl
    }
  }
`;

export const SPOTIFY_SEARCH_ARTISTS_QUERY = gql`
  query SpotifySearchArtists($query: String!) {
    spotifySearchArtists(query: $query) {
      id
      name
      imageUrl
    }
  }
`;

export const SPOTIFY_ARTIST_TRACKS_QUERY = gql`
  query SpotifyArtistTracks($artistId: ID!, $limit: Int) {
    spotifyArtistTracks(artistId: $artistId, limit: $limit) {
      id
      name
      artistName
      albumName
      albumImageUrl
      durationMs
    }
  }
`;

export const STREAMING_TRACK_FROM_URL_QUERY = gql`
  query StreamingTrackFromUrl($url: String!) {
    streamingTrackFromUrl(url: $url) {
      source
      spotifyTrackId
      externalId
      name
      artistName
      albumName
      albumImageUrl
      durationMs
    }
  }
`;

export const MY_CATALOG_TRACKS_QUERY = gql`
  query MyCatalogTracks {
    myCatalogTracks {
      id
      spotifyTrackId
      name
      artistName
      albumName
      albumImageUrl
      durationMs
    }
  }
`;

export const CAMPAIGN_QUERY = gql`
  query Campaign($id: ID!) {
    campaign(id: $id) {
      id
      trackTitle
      artistName
      spotifyTrackId
      trackUrl
      trackS3Key
      status
      hookStart
      hookEnd
      videoS3Key
      videoUrl
      ${EDITOR_SETTINGS_FRAGMENT}
      metaCampaignId
      createdAt
      generatedAd {
        id
        videoUrl
        videoS3Key
        metaAdId
        createdAt
      }
    }
  }
`;

export const SUGGEST_HOOKS_QUERY = gql`
  query SuggestHooks(
    $campaignId: ID!
    $audioDurationSec: Float
    $audioEnergyEnvelope: [Float!]
  ) {
    suggestHooks(
      campaignId: $campaignId
      audioDurationSec: $audioDurationSec
      audioEnergyEnvelope: $audioEnergyEnvelope
    ) {
      start
      end
      label
      energy
    }
  }
`;

export const SUGGEST_MOOD_QUERY = gql`
  query SuggestMood(
    $campaignId: ID!
    $audioDurationSec: Float
    $audioEnergyEnvelope: [Float!]
  ) {
    suggestMood(
      campaignId: $campaignId
      audioDurationSec: $audioDurationSec
      audioEnergyEnvelope: $audioEnergyEnvelope
    ) {
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

export const SEARCH_PEXELS_VIDEOS_QUERY = gql`
  query SearchPexelsVideos($query: String!, $page: Int) {
    searchPexelsVideos(query: $query, page: $page) {
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
