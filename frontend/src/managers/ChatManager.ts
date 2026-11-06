import type ChatMessage from "@shared/interfaces/ChatMessage";
import ChatLog from "../models/ChatLog";



/**
 * Manages the local chat state for a room.
 */
export default class ChatManager {
    private chat: ChatLog = new ChatLog();
    private updateChatUI: (messages: ChatMessage[], isHistory: boolean) => void;


    /**
     * Creates a new ChatManager instance.
     */
    constructor(updateChatUI: (messages: ChatMessage[], isHistory: boolean) => void) {
        this.updateChatUI = updateChatUI;
    }


    public add(msg: ChatMessage) {
        this.chat.add(msg);
        this.updateChatUI(this.chat.getChatLog(), false);
    }


    public hydrate(messages: ChatMessage[]) {
        this.chat.replace(messages);
        this.updateChatUI(this.chat.getChatLog(), true);
    }


    /**
     * Cleans up all resources associated with this RoomManager,
     * including socket listeners and video manager instances.
     */
    destroy() {

    }
}
