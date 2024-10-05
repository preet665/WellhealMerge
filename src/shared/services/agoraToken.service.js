// src/services/agoraToken.service.js

import pkg from 'agora-access-token';

const { RtcTokenBuilder, RtcRole } = pkg;
import dotenv from 'dotenv';
dotenv.config();

/**
 * Generates an Agora token for a given channel.
 * @param {String} channelName - The name of the Agora channel.
 * @param {String} userId - The unique identifier of the user.
 * @returns {String} - The generated Agora token.
 */
export const generateAgoraToken = (channelName, userId) => {
    try {
        const APP_ID = process.env.AGORA_APP_ID;
        const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

        if (!APP_ID || !APP_CERTIFICATE) {
            throw new Error("Agora App ID and Certificate are not configured");
        }

        const role = RtcRole.PUBLISHER;
        const expirationTimeInSeconds = 3600; // Token valid for 1 hour
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

        // Use userId as the UID if it's a numeric value, else use 0
        const uidAsNumber = isNaN(userId) ? 0 : parseInt(userId, 10);

        const token = RtcTokenBuilder.buildTokenWithUid(
            APP_ID,
            APP_CERTIFICATE,
            channelName,
            uidAsNumber,
            role,
            privilegeExpiredTs
        );

        return token;

    } catch (error) {
        console.error("generateAgoraToken Service Error:", error);
        throw error;
    }
};
