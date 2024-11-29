import {createCode, deactivateCode, getCodes, getCode, revokeAppUserEntitlement} from '../shared/services/giftcodes/giftcodes.service.js'



export async function createGiftcode(req, res) {
    try {
        const userId = req.userdata._id;

        // check user input 
        const { amount, expiry_days, max_uses, description, is_active, subscription_id, platform } = req.body;
        if(!amount || isNaN(amount)) throw new Error("Amount not set or invalid amount set");
        if(!expiry_days || isNaN(expiry_days)) throw new Error("Invalid Expiry Days set");

        let apple_subscription_id = undefined
        let googleplay_subscription_id = undefined
        if(subscription_id && platform == 'ios'){
            apple_subscription_id = subscription_id;
        }
        if(subscription_id && platform == 'android'){
            googleplay_subscription_id = subscription_id;
        }

        let isActive = true
        if(is_active == false){
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
            ...(googleplay_subscription_id && {
                googleplay_subscription_id: googleplay_subscription_id
            })
        }
        
        const gcResponse = await createCode(userId, payload);

        return res.status(200).send({
            success: true,
            data: gcResponse.data,
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
            data: gcResponse.data,
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
export async function getGiftcode(req, res) {
    try {
        const userId = req.userdata._id;

        const {code} = req.params;

        const gcResponse = await getCode(userId, code);

        return res.status(200).send({
            success: true,
            data: gcResponse.data,
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

        const {giftcode} = req.body;


        const gcResponse = await deactivateCode(userId, giftcode);

        return res.status(200).send({
            success: true,
            data: gcResponse.data,
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
            // data: gcResponse,
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

