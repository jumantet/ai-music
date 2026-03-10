export const typeDefs = `#graphql
  scalar Upload

  enum Plan {
    FREE
    PRO
  }

  enum ContactType {
    BLOG
    RADIO
    PLAYLIST
    JOURNALIST
  }

  enum OutreachStatus {
    NOT_CONTACTED
    SENT
    REPLIED
    FEATURED
  }

  type User {
    id: ID!
    email: String!
    name: String!
    plan: Plan!
    emailVerified: Boolean!
    createdAt: String!
    releases: [Release!]!
  }

  type Release {
    id: ID!
    title: String!
    artistName: String!
    genre: String
    mood: String
    bpm: Float
    trackUrl: String
    coverUrl: String
    city: String
    influences: String
    shortBio: String
    epkPage: EPKPage
    pressKit: PressKit
    createdAt: String!
  }

  type EPKPage {
    id: ID!
    releaseId: ID!
    slug: String!
    bio: String
    pressPitch: String
    shortBio: String
    releaseDescription: String
    isPublished: Boolean!
    release: Release
    createdAt: String!
  }

  type PressKit {
    id: ID!
    releaseId: ID!
    zipUrl: String!
    generatedAt: String!
  }

  type Contact {
    id: ID!
    name: String!
    email: String!
    type: ContactType!
    website: String
    notes: String
    createdAt: String!
  }

  type Outreach {
    id: ID!
    contactId: ID!
    releaseId: ID!
    subject: String!
    body: String!
    status: OutreachStatus!
    sentAt: String
    repliedAt: String
    contact: Contact
    release: Release
    createdAt: String!
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

  type OutreachDraft {
    subject: String!
    body: String!
  }

  type Query {
    me: User!
    release(id: ID!): Release!
    releases: [Release!]!
    epkPage(slug: String!): EPKPage
    contacts: [Contact!]!
    outreach(releaseId: ID!): [Outreach!]!
  }

  input CreateReleaseInput {
    title: String!
    artistName: String!
    genre: String
    mood: String
    bpm: Float
    city: String
    influences: String
    shortBio: String
  }

  input UpdateReleaseInput {
    title: String
    artistName: String
    genre: String
    mood: String
    bpm: Float
    city: String
    influences: String
    shortBio: String
  }

  input CreateContactInput {
    name: String!
    email: String!
    type: ContactType!
    website: String
    notes: String
  }

  input UpdateContactInput {
    name: String
    email: String
    type: ContactType
    website: String
    notes: String
  }

  type Mutation {
    signup(email: String!, password: String!, name: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    verifyEmail(token: String!): AuthPayload!
    resendVerificationEmail: Boolean!

    createRelease(input: CreateReleaseInput!): Release!
    updateRelease(id: ID!, input: UpdateReleaseInput!): Release!
    deleteRelease(id: ID!): Boolean!
    setReleaseCover(releaseId: ID!, fileUrl: String!): Release!
    setReleaseTrack(releaseId: ID!, fileUrl: String!, bpm: Float, genre: String, mood: String): Release!

    getUploadUrl(releaseId: ID!, fileType: String!, contentType: String!): UploadUrlPayload!

    generateEPK(releaseId: ID!): EPKPage!
    updateEPKPage(releaseId: ID!, bio: String, pressPitch: String, shortBio: String, releaseDescription: String): EPKPage!
    publishEPKPage(releaseId: ID!): EPKPage!
    unpublishEPKPage(releaseId: ID!): EPKPage!

    generatePressKit(releaseId: ID!): PressKit!

    createContact(input: CreateContactInput!): Contact!
    updateContact(id: ID!, input: UpdateContactInput!): Contact!
    deleteContact(id: ID!): Boolean!

    generateOutreachEmail(releaseId: ID!, contactType: ContactType!, contactName: String): OutreachDraft!
    createOutreach(releaseId: ID!, contactId: ID!, subject: String!, body: String!): Outreach!
    updateOutreachStatus(id: ID!, status: OutreachStatus!): Outreach!
    sendOutreachEmail(id: ID!): Outreach!
    deleteOutreach(id: ID!): Boolean!

    createStripeCheckout: String!
    createStripePortal: String!
  }
`;
