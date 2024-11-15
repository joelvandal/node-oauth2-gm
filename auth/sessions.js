import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const SESSIONS_DIR = path.resolve("sessions");

/**
 * Ensure the sessions directory exists.
 */
export async function ensureSessionsDir() {
  try {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  } catch (err) {
    console.error("Error creating sessions directory:", err);
    throw err;
  }
}

/**
 * Generate a safe file path based on the email.
 * @param {string} email - The email address.
 * @returns {string} The file path for the session file.
 */
function getSessionFilePath(email) {
  const safeEmail = crypto.createHash("sha256").update(email).digest("hex");
  return path.join(SESSIONS_DIR, `${safeEmail}.json`);
}

/**
 * Read session data for an email.
 * @param {string} email - The email address.
 * @returns {Object|null} The session data, or null if not found.
 */
export async function readSession(email) {
  const filePath = getSessionFilePath(email);
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      return null; // Return null if the file doesn't exist
    }
    console.error(`Error reading session for ${email}:`, err);
    throw err;
  }
}

/**
 * Write session data for an email.
 * @param {string} email - The email address.
 * @param {Object} sessionData - The session data to save.
 */
export async function writeSession(email, sessionData) {
  const filePath = getSessionFilePath(email);
  try {
    await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2));
    console.log(`Session data written for ${email}`);
  } catch (err) {
    console.error(`Error writing session for ${email}:`, err);
    throw err;
  }
}

/**
 * Delete session data for an email.
 * @param {string} email - The email address.
 */
export async function deleteSession(email) {
  const filePath = getSessionFilePath(email);
  try {
    await fs.unlink(filePath);
    console.log(`Session deleted for ${email}`);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(`Error deleting session for ${email}:`, err);
      throw err;
    }
  }
}
