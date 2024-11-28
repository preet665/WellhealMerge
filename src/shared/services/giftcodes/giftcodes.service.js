import { logger, level } from "../../../config/logger.js";
import { beautify } from "../../utils/utility.js";

const API_URL = process.env.APP_BACKEND_ACCESS_URL;


export const createCode = async (userId, payload) => {
    try {
        const headers = {
            'Authorization': `Bearer ${process.env.APP_BACKEND_ACCESS_API}`,
            'x-auth-user': `${userId}`,
            'Content-Type': 'application/json'
        };
        const url = `${API_URL}/gift-codes/create`;
        const options = {
            method: 'POST',
            headers: (headers),
            body: JSON.stringify(payload),
        }
        const response = await fetch(url, options);

        if (!response.ok) {
            if(response.body){
                let errMessage = (await response.json()).message;
                throw new Error(`Giftcode API error: ${errMessage}`);
            }
            throw new Error(`Giftcode API error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        logger.log(level.error, `createCode Error: ${beautify(error.message)}`);
        throw error;
    }
};



export const getCodes = async (userId) => {
    try {
        const headers = {
            'Authorization': `Bearer ${process.env.APP_BACKEND_ACCESS_API}`,
            'x-auth-user': `${userId}`,
            'Content-Type': 'application/json'
        };
        const url = `${API_URL}/gift-codes`;
        const options = {
            method: 'POST',
            headers: (headers),
        }
        const response = await fetch(url, options);

        if (!response.ok) {
            if(response.body){
                let errMessage = (await response.json()).message;
                throw new Error(`Giftcode API error: ${errMessage}`);
            }
            throw new Error(`Giftcode API error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        logger.log(level.error, `getCodes Error: ${beautify(error.message)}`);
        throw error;
    }
};



export const deactivateCode = async (userId, codeId) => {
    try {
        const headers = {
            'Authorization': `Bearer ${process.env.APP_BACKEND_ACCESS_API}`,
            'x-auth-user': `${userId}`,
            'Content-Type': 'application/json'
        };
        const url = `${API_URL}/gift-codes/deactivate/${codeId}`;
        const options = {
            method: 'POST',
            headers: (headers),
            body: JSON.stringify({}),
        }
        const response = await fetch(url, options);

        if (!response.ok) {
            if(response.body){
                let errMessage = (await response.json()).message;
                throw new Error(`Giftcode API error: ${errMessage}`);
            }
            throw new Error(`Giftcode API error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        logger.log(level.error, `deactivateCode Error: ${beautify(error.message)}`);
        throw error;
    }
};



export const revokeAppUserEntitlement = async (userId, payload) => {
    try {
        const headers = {
            'Authorization': `Bearer ${process.env.APP_BACKEND_ACCESS_API}`,
            'x-auth-user': `${userId}`,
            'Content-Type': 'application/json'
        };
        const url = `${API_URL}/gift-codes/revoke-user-entitlement`;
        const options = {
            method: 'POST',
            headers: (headers),
            body: JSON.stringify(payload),
        }
        const response = await fetch(url, options);

        if (!response.ok) {
            if(response.body){
                let errMessage = (await response.json()).message;
                throw new Error(`Giftcode API error: ${errMessage}`);
            }
            throw new Error(`Giftcode API error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        logger.log(level.error, `deactivateCode Error: ${beautify(error.message)}`);
        throw error;
    }
};

