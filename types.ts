export enum MessageSender {
  User = 'user',
  Bot = 'bot',
  System = 'system',
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
}

export enum BotStatus {
  Idle = 'Idle',
  Processing = 'Processing...',
  Speaking = 'Speaking...',
  Error = 'Error',
}