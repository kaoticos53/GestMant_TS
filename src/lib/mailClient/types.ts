/**
 * DTOs del núcleo de correo. Son tipos de dominio: no saben nada de Convex, de
 * React ni de la red, para que los parsers y la política de caché se prueben en
 * memoria.
 */

export type MailFolderKind = string | null;

export interface MailFolder {
  remoteId: string;
  parentRemoteId: string | null;
  name: string;
  path: string;
  kind: MailFolderKind;
  isMail: boolean;
  unread: number;
  total: number;
  size: number;
  sortOrder: number;
}

export interface MailHeader {
  messageId: string;
  folderRemoteId: string;
  conversationId: string | null;
  subject: string;
  fromName: string;
  fromAddress: string;
  date: number;
  size: number;
  flags: string;
  hasAttachments: boolean;
  snippet: string;
}

export interface MailSearchPage {
  headers: MailHeader[];
  offset: number;
  more: boolean;
  sortBy: string | null;
}

export interface MailSyncPage {
  changedIds: string[];
  deletedIds: string[];
  token: string | null;
  more: boolean;
}

export interface MailMessageDownload {
  messageId: string;
  size: number;
  contentUrl: string;
}

export interface MailAuthSession {
  authToken: string;
  lifetimeMs: number;
}

/** Una parte adjunta ya decodificada, antes de guardarla en `_storage`. */
export interface MailAttachmentPart {
  partIndex: number;
  filename: string | null;
  contentType: string;
  contentId: string | null;
  inline: boolean;
  content: Uint8Array;
}

/** Lo que se persiste del RFC822: texto, HTML y partes, nunca el original. */
export interface MailMessageContent {
  text: string;
  textTruncated: boolean;
  html: string | null;
  htmlTruncated: boolean;
  bodyBytes: number;
  attachments: MailAttachmentPart[];
}
