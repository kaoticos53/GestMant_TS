import type { api } from "@/convex/_generated/api";

export type MailboxAccount = NonNullable<
  (typeof api.mailAccounts.account)["_returnType"]
>;
export type MailboxFolder =
  (typeof api.mailAccounts.folders)["_returnType"][number];
export type MailboxHeader =
  (typeof api.mailHeaders.list)["_returnType"]["headers"][number];
