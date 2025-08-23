type MessageStatus = {
  status: "SENT" | "DELIVERED" | "READ";
  updatedAt: string;
};

export interface MessageFromApi {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  type: string;
  sender: {
    id: string;
    name: string;
  };
  statuses?: MessageStatus[];
}

export interface ConversationFromApi {
  id: string;
  name: string | null;
  isGroup: boolean;
  createdAt: string;
  updatedAt: string;
  Message: MessageFromApi[];
  participants: {
    user: {
      id: string;
      name: string;
      phoneNumber: string;
    };
  }[];
}

export interface UserInfoApi {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}