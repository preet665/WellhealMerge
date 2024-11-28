import {createCode, deactivateCode, getCodes, revokeAppUserEntitlement} from '../shared/services/giftcodes/giftcodes.service.js'



export async function createGiftcode(req, res) {
    try {
        const userId = req.userdata._id;

        // check user input 
        const { amount, expiry_days, max_uses, description, is_active, subscription_id } = req.body;
        if(!amount || isNaN(amount)) throw new Error("Amount not set or invalid amount set");
        if(!expiry_days || isNaN(expiry_days)) throw new Error("Invalid Expiry Days set");

        let apple_subscription_id = undefined
        let google_subscription_id = undefined
        if(subscription_id && subscription_id.slice(0,4) == 'apple'){
            apple_subscription_id = subscription_id;
        }
        if(subscription_id && subscription_id.slice(0,5) == 'google'){
            google_subscription_id = subscription_id;
        }

        let isActive = true
        if(is_active && is_active === false){
            isActive = false
        }

        const payload = { 
            amount,
            expiry_days,
            max_uses: max_uses || 1,
            description: description || '',
            is_active: isActive,
            ...(apple_subscription_id && {
                apple_subscription_id: apple_subscription_id
            }),
            ...(google_subscription_id && {
                google_subscription_id: google_subscription_id
            })
        }
        
        const gcResponse = await createCode(userId, payload);

        return res.status(200).send({
            success: true,
            data: gcResponse,
            message: "Giftcode created successfully..!",
        });
    } catch (error) {
        console.log("error====>", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: error.message,
        });
    }
}

// 
export async function getGiftcodes(req, res) {
    try {
        const userId = req.userdata._id;


        const gcResponse = await getCodes(userId);

        return res.status(200).send({
            success: true,
            data: gcResponse,
            message: "Giftcodes retrieved successfully..!",
        });
    } catch (error) {
        console.log("error====>", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: error.message,
        });
    }
}

// 
export async function deactivateGiftcodes(req, res) {
    try {
        const userId = req.userdata._id;

        const {giftCodeId} = req.params;


        const gcResponse = await deactivateCode(userId, giftCodeId);

        return res.status(200).send({
            success: true,
            data: gcResponse,
            message: "Giftcode deactivated successfully..!",
        });
    } catch (error) {
        console.log("error====>", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: error.message,
        });
    }
}


// 
export async function revokeAppUserAccess(req, res) {
    try {
        const userId = req.userdata._id;
        const {userId : appUserId} = req.body;

        const payload = {
            appUserId: appUserId
        }

        const gcResponse = await revokeAppUserEntitlement(userId, payload);

        return res.status(200).send({
            success: true,
            data: gcResponse,
            message: "App user entitlement revoked successfully..!",
        });
    } catch (error) {
        console.log("error====>", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: error.message,
        });
    }
}

