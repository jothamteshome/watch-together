import { uniqueNamesGenerator, type Config, adjectives, colors, animals } from 'unique-names-generator';
import type User from "../interfaces/User";


const usernameConfig: Config = {
  dictionaries: [adjectives, colors, animals],
  separator: '',
  style: "capital",
  length: 3,
};


export default function generateUser(socketId: string): User {
    const username: string = uniqueNamesGenerator(usernameConfig);
    const icon: string = `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`;

    const userData: User = {
        id: socketId,
        username: username,
        icon: icon
    };

    return userData;
}