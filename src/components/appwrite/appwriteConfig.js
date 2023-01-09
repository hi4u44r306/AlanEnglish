import { Client, Account, Databases } from "appwrite";

const client = new Client();

client.setEndpoint("http://localhost/v1").setProject("63b84357e64716f1e350")

export const account = new Account(client);

//Database

export const databases = new Databases(client, "63b8ce937c0a65408f6e")
