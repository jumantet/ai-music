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
      }
    }
  }
`;

export const CREATE_RELEASE_MUTATION = gql`
  mutation CreateRelease($input: CreateReleaseInput!) {
    createRelease(input: $input) {
      id
      title
      artistName
      genre
      mood
      city
      influences
      shortBio
      createdAt
    }
  }
`;

export const UPDATE_RELEASE_MUTATION = gql`
  mutation UpdateRelease($id: ID!, $input: UpdateReleaseInput!) {
    updateRelease(id: $id, input: $input) {
      id
      title
      artistName
      genre
      mood
      bpm
      city
      influences
      shortBio
    }
  }
`;

export const DELETE_RELEASE_MUTATION = gql`
  mutation DeleteRelease($id: ID!) {
    deleteRelease(id: $id)
  }
`;

export const GET_UPLOAD_URL_MUTATION = gql`
  mutation GetUploadUrl($releaseId: ID!, $fileType: String!, $contentType: String!) {
    getUploadUrl(releaseId: $releaseId, fileType: $fileType, contentType: $contentType) {
      uploadUrl
      fileUrl
      key
    }
  }
`;

export const SET_RELEASE_COVER_MUTATION = gql`
  mutation SetReleaseCover($releaseId: ID!, $fileUrl: String!) {
    setReleaseCover(releaseId: $releaseId, fileUrl: $fileUrl) {
      id
      coverUrl
    }
  }
`;

export const SET_RELEASE_TRACK_MUTATION = gql`
  mutation SetReleaseTrack($releaseId: ID!, $fileUrl: String!, $bpm: Float, $genre: String, $mood: String) {
    setReleaseTrack(releaseId: $releaseId, fileUrl: $fileUrl, bpm: $bpm, genre: $genre, mood: $mood) {
      id
      trackUrl
      bpm
      genre
      mood
    }
  }
`;

export const GENERATE_EPK_MUTATION = gql`
  mutation GenerateEPK($releaseId: ID!) {
    generateEPK(releaseId: $releaseId) {
      id
      slug
      bio
      pressPitch
      shortBio
      releaseDescription
      isPublished
    }
  }
`;

export const UPDATE_EPK_PAGE_MUTATION = gql`
  mutation UpdateEPKPage(
    $releaseId: ID!
    $bio: String
    $pressPitch: String
    $shortBio: String
    $releaseDescription: String
  ) {
    updateEPKPage(
      releaseId: $releaseId
      bio: $bio
      pressPitch: $pressPitch
      shortBio: $shortBio
      releaseDescription: $releaseDescription
    ) {
      id
      bio
      pressPitch
      shortBio
      releaseDescription
    }
  }
`;

export const PUBLISH_EPK_MUTATION = gql`
  mutation PublishEPKPage($releaseId: ID!) {
    publishEPKPage(releaseId: $releaseId) {
      id
      slug
      isPublished
    }
  }
`;

export const UNPUBLISH_EPK_MUTATION = gql`
  mutation UnpublishEPKPage($releaseId: ID!) {
    unpublishEPKPage(releaseId: $releaseId) {
      id
      slug
      isPublished
    }
  }
`;

export const GENERATE_PRESS_KIT_MUTATION = gql`
  mutation GeneratePressKit($releaseId: ID!) {
    generatePressKit(releaseId: $releaseId) {
      id
      zipUrl
      generatedAt
    }
  }
`;

export const CREATE_CONTACT_MUTATION = gql`
  mutation CreateContact($input: CreateContactInput!) {
    createContact(input: $input) {
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

export const UPDATE_CONTACT_MUTATION = gql`
  mutation UpdateContact($id: ID!, $input: UpdateContactInput!) {
    updateContact(id: $id, input: $input) {
      id
      name
      email
      type
      website
      notes
    }
  }
`;

export const DELETE_CONTACT_MUTATION = gql`
  mutation DeleteContact($id: ID!) {
    deleteContact(id: $id)
  }
`;

export const GENERATE_OUTREACH_EMAIL_MUTATION = gql`
  mutation GenerateOutreachEmail($releaseId: ID!, $contactType: ContactType!, $contactName: String) {
    generateOutreachEmail(releaseId: $releaseId, contactType: $contactType, contactName: $contactName) {
      subject
      body
    }
  }
`;

export const CREATE_OUTREACH_MUTATION = gql`
  mutation CreateOutreach($releaseId: ID!, $contactId: ID!, $subject: String!, $body: String!) {
    createOutreach(releaseId: $releaseId, contactId: $contactId, subject: $subject, body: $body) {
      id
      subject
      body
      status
      contact {
        id
        name
        email
        type
      }
    }
  }
`;

export const UPDATE_OUTREACH_STATUS_MUTATION = gql`
  mutation UpdateOutreachStatus($id: ID!, $status: OutreachStatus!) {
    updateOutreachStatus(id: $id, status: $status) {
      id
      status
      sentAt
      repliedAt
    }
  }
`;

export const SEND_OUTREACH_EMAIL_MUTATION = gql`
  mutation SendOutreachEmail($id: ID!) {
    sendOutreachEmail(id: $id) {
      id
      status
      sentAt
    }
  }
`;

export const DELETE_OUTREACH_MUTATION = gql`
  mutation DeleteOutreach($id: ID!) {
    deleteOutreach(id: $id)
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
