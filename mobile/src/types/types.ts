export interface MessageFromApi {
  id: string;
  createdAt: Date;
  conversationId: string;
  senderId: string;
  text: string;
  deliveredAt: Date | null;
  readAt: Date | null;
}

export interface MessageWithSender extends MessageFromApi {
  sender: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface Conversation {
  id: string;
  lastMessage: MessageWithSender | null;
}

export interface UserList {
  id: string;
  name: string | null;
  email: string;
  conversation: Conversation | null;
}

export interface UserInfoApi {
  id: string
  name?: string
  email: string
}