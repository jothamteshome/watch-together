import type ChatMessage from "../interfaces/ChatMessage";

export default class ChatLog {
    private items: ChatMessage[] = [];


    public add(msg: ChatMessage) {
        this.items.push(msg);
    }


    get length(): number {
        return this.items.length;
    }


    public getChatLog(): ChatMessage[] {
        return [ ...this.items ];
    };
}