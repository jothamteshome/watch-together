import { uniqueNamesGenerator, type Config, adjectives, colors, animals } from 'unique-names-generator';
import { nanoid } from 'nanoid';
import type User from "@shared/interfaces/User";


const usernameConfig: Config = {
  dictionaries: [adjectives, colors, animals],
  separator: '',
  style: "capital",
  length: 3,
};


export default function generateUser(): User {
    const username: string = uniqueNamesGenerator(usernameConfig);
    const icon: string = `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`;

    const userData: User = {
        id: nanoid(),
        username: username,
        icon: icon
    };

    return userData;
}