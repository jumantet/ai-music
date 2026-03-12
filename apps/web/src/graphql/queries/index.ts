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
      releases {
        id
        title
        artistName
        genre
        mood
        coverUrl
        trackUrl
        city
        influences
        shortBio
        createdAt
        epkPage {
          id
          slug
          isPublished
          bio
          pressPitch
          shortBio
          releaseDescription
        }
        pressKit {
          id
          zipUrl
          generatedAt
        }
      }
    }
  }
`;

export const RELEASE_QUERY = gql`
  query Release($id: ID!) {
    release(id: $id) {
      id
      title
      artistName
      genre
      mood
      bpm
      trackUrl
      coverUrl
      city
      influences
      shortBio
      createdAt
      epkPage {
        id
        slug
        bio
        pressPitch
        shortBio
        releaseDescription
        isPublished
        createdAt
      }
      pressKit {
        id
        zipUrl
        generatedAt
      }
      videoAdCampaign {
        id
        selectedVideoUrls
        status
        createdAt
      }
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

export const SEARCH_VIDEOS_QUERY = gql`
  query SearchVideosForRelease($releaseId: ID!) {
    searchVideosForRelease(releaseId: $releaseId) {
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
  }
`;

export const EPK_PAGE_QUERY = gql`
  query EPKPage($slug: String!) {
    epkPage(slug: $slug) {
      id
      slug
      bio
      pressPitch
      shortBio
      releaseDescription
      isPublished
      release {
        id
        title
        artistName
        genre
        mood
        coverUrl
        trackUrl
        city
        influences
      }
    }
  }
`;

export const CONTACTS_QUERY = gql`
  query Contacts {
    contacts {
      id
      name
      email
      type
      website
      notes
      createdAt
    }
  }
`;

export const OUTREACH_QUERY = gql`
  query Outreach($releaseId: ID!) {
    outreach(releaseId: $releaseId) {
      id
      subject
      body
      status
      sentAt
      repliedAt
      createdAt
      contact {
        id
        name
        email
        type
      }
      release {
        id
        title
        artistName
      }
    }
  }
`;
