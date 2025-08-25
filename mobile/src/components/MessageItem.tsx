import React from "react";
import dayjs from "dayjs";
import { useMessageListStore } from "../store/messagesListStore";

const getStatusIcon = (status: "SENT" | "DELIVERED" | "READ") => {
  switch (status) {
    case "SENT":
      return "/images/sent.svg";
    case "DELIVERED":
      return "/images/delivered.svg";
    case "READ":
      return "/images/read.svg";
  }
};

export const MessageItem = React.memo(
  ({
    messageId,
    isRecipient,
    lastMessageRef,
  }: {
    messageId: string;
    isRecipient: boolean;
    lastMessageRef?: React.RefObject<HTMLDivElement | null>;
  }) => {
    // 👇 Instead of grabbing the whole object,
    // pick out the fields we care about.
    const { text, createdAt, deliveredAt, readAt } = useMessageListStore(
      (state) => state.messageMap[messageId] || {}
    );

    // If message was deleted or not found
    if (!text) return null;

    let status: "SENT" | "DELIVERED" | "READ" = "SENT";
    if (readAt) {
      status = "READ";
    } else if (deliveredAt) {
      status = "DELIVERED";
    }

    const statusIcon = getStatusIcon(status);

    return isRecipient ? (
      <div ref={lastMessageRef} className="flex justify-start">
        <div className="inline-block bg-neutral-200 rounded-2xl py-2 px-3 text-black">
          <div className="flex flex-col py-2">
            <p className="text-sm">{text}</p>
          </div>
        </div>
      </div>
    ) : (
      <div ref={lastMessageRef} className="flex justify-end">
        <div className="inline-block bg-neutral-500 rounded-2xl py-2 px-3 text-white">
          <div className="flex flex-col py-2">
            <p className="text-sm">{text}</p>
            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-gray-200 opacity-70">
              <span>{dayjs(createdAt).format("h:mm A")}</span>
              {statusIcon && (
                <img src={statusIcon} alt={status} className="w-6" />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
