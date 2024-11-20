import { CookieJar } from "tough-cookie";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const COOKIE_JARS_DIR = path.resolve("cookies");

/**
 * Ensure the tokens directory exists.
 */
export async function ensureCookiesDir() {
  try {
    await fs.mkdir(COOKIE_JARS_DIR, { recursive: true });
  } catch (err) {
    console.error("Error creating cokkies directory:", err);
    throw err;
  }
}

/**
 * Create a unique cookie jar path for each user based on their email.
 */
function getCookieJarPath(email) {
  const safeEmail = crypto.createHash("sha256").update(email).digest("hex");
  return path.join(COOKIE_JARS_DIR, `${safeEmail}.json`);
}

/**
 * Create or load a cookie jar for a specific user.
 */
export async function loadCookieJar(email) {
  const jarPath = getCookieJarPath(email);
  let jar = new CookieJar();

  try {
    const data = await fs.readFile(jarPath, "utf-8");
    jar = await CookieJar.deserialize(JSON.parse(data)); // Deserialize the jar from JSON
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Error loading cookie jar:", err);
    }
    // If file doesn't exist, just return a new jar
  }

  return jar;
}

/**
 * Save a user's cookie jar to disk.
 */
export async function saveCookieJar(email, jar) {
  const jarPath = getCookieJarPath(email);
  try {
    const serialized = jar.serializeSync();
    await fs.writeFile(jarPath, JSON.stringify(serialized), "utf-8");
  } catch (err) {
    console.error("Error saving cookie jar:", err);
  }
}
