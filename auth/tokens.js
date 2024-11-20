import fs from "fs/promises";
import crypto from "crypto";
import path from "path";

const TOKENS_DIR = path.resolve("tokens");

import { setupClient } from "./utils.js";

/**
 * Ensure the tokens directory exists.
 */
export async function ensureTokensDir() {
  try {
    await fs.mkdir(TOKENS_DIR, { recursive: true });
  } catch (err) {
    console.error("Error creating sessions directory:", err);
    throw err;
  }
}

function getTokenFilePath(email) {
  const safeEmail = crypto.createHash("sha256").update(email).digest("hex");
  return path.join(TOKENS_DIR, `${safeEmail}.json`);
}

export async function saveTokens(email, tokens) {
  const tokenPath = getTokenFilePath(email);
  await fs.writeFile(tokenPath, JSON.stringify(tokens));
}

export async function loadAccessToken(email) {
  const tokenPath = getTokenFilePath(email);
  const client = await setupClient();

  try {
    // Check if the file exists asynchronously
    await fs.access(tokenPath);
    const storedTokens = JSON.parse(await fs.readFile(tokenPath, "utf-8"));
    const now = Math.floor(Date.now() / 1000);

    if (storedTokens.expires_at > now) {
      return storedTokens;
    } else if (storedTokens.refresh_token) {
      const tokenSet = await client.refresh(storedTokens.refresh_token);
      await saveTokens(email, tokenSet);
      return tokenSet;
    }
  } catch (err) {
    // If file doesn't exist or another error occurs
    if (err.code !== "ENOENT") {
      console.error("Error accessing token file:", err);
    }
  }

  return false;
}
