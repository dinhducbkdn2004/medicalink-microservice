export interface EmailSendDto {
  templateKey: string;
  to: string;
  subject?: string;
  context?: Record<string, any>;
  cc?: string[];
  bcc?: string[];
  attachments?: {
    filename: string;
    content?: string | Buffer;
    path?: string;
  }[];
  headers?: Record<string, string>;
}
