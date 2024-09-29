import { logger, level } from "../../config/logger.js";
import { beautify, unauthorizedError } from "../../shared/utils/utility.js";
import JWTAuth from "../../shared/services/jwt_auth/jwt_auth.service.js";
import { constants } from '../../shared/constant/application.const.js';
import pkg from "lodash";
import { isExistOrNot } from "../services/database/query.service.js";
import messages from "../constant/messages.const.js";
import User from "../../models/user.model.js";
import DoctorToken from "../../models/doctor_token.model.js";
const { _ } = pkg;

const auth = new JWTAuth();
const tokenLength = 2;
const tokenSplitBy = " ";
const AUTHORIZATION_HEADER_NAME = "authorization";
const VERIFICATION_HEADER_NAME = "x-auth-token";
const CURRENT_USER = "currentUser";
const CURRENT_USER_ID = "currentUserId";
const CURRENT_DOCTOR = "currentDoctor";
const CURRENT_DOCTOR_ID = "currentDoctorId";
const SKIP_AUTH_FOR = [];

export const adminAuthMiddleware = async (req, res, next) => {
    console.log("adminAuthMiddleware invoked");
    console.log("Request method:", req.method);
    console.log("Request URL:", req._parsedUrl.pathname);

    if (!requireAuth(req.method, req._parsedUrl.pathname)) {
        console.log("Skipping auth for this route");
        next();
        return;
    }

    const authorization = req.headers[AUTHORIZATION_HEADER_NAME];
    console.log("Authorization header:", authorization);

    if (authorization) {
        let tokenParts = authorization.split(tokenSplitBy);
        console.log("Token parts:", tokenParts);

        let length = tokenParts.length;
        if (length == tokenLength) {
            let accessToken = tokenParts[1];
            console.log("Access token:", accessToken);

            try {
                let decoded = await auth.verifyAdminToken(accessToken);
                console.log("Decoded token:", decoded);

                const email = decoded.email;
                const userId = decoded.userId;
                console.log("Decoded email:", email);
                console.log("Decoded userId:", userId);

                const user = await User.findOne({ _id: userId, token: accessToken }).lean();
                console.log("User found in DB:", user);

                if (user) {
                    logger.log(level.debug, `Admin token exists in the database for userId: ${userId}`);
                } else {
                    console.log(`Admin token does not exist in the database for userId: ${userId}`);
                    return unauthorizedError(res, messages.not_exist.replace("{dynamic}", "AccessToken"));
                }

                req[CURRENT_USER] = email;
                req[CURRENT_USER_ID] = userId;
                next();
                return;
            } catch (e) {
                console.log("Error in adminAuthMiddleware:", e);
                logger.log(level.error, `adminAuthMiddleware Error: ${e}`);
            }
        }
    }
    console.log("Authorization failed, returning unauthorized error");
    return unauthorizedError(res);
};

export const doctorAuthMiddleware = async (req, res, next) => {
    console.log("doctorAuthMiddleware invoked");

    const authorization = req.headers[AUTHORIZATION_HEADER_NAME];
    console.log("Authorization header received:", authorization);

    if (authorization) {
        let token = authorization.split(tokenSplitBy);
        console.log("Token split:", token);

        let length = token.length;
        if (length === tokenLength) {
            let accessToken = token[1];
            console.log("Access token:", accessToken);

            try {
                let decoded = await auth.verifyDoctorToken(accessToken);
                console.log("Decoded token:", decoded);

                const doctorId = decoded.userId;
                console.log("Decoded doctorId:", doctorId);

                req.userdata = {
                    _id: doctorId,
                    email: decoded.email,
                    role: decoded.role,
                };
                console.log("req.userdata set:", req.userdata);

                next();
                return;
            } catch (e) {
                console.log("Error in doctorAuthMiddleware:", e);
                logger.log(level.error, `doctorAuthMiddleware Error: ${e}`);
                return unauthorizedError(res, 'Unauthorized');
            }
        }
    }
    console.log("Authorization failed, returning unauthorized error");
    return unauthorizedError(res);
};

export const authMiddleware = async (req, res, next) => {
    console.log("authMiddleware invoked");
    console.log("Request method:", req.method);
    console.log("Request URL:", req._parsedUrl.pathname);

    if (!requireAuth(req.method, req._parsedUrl.pathname)) {
        console.log("Skipping auth for this route");
        next();
        return;
    }

    const authorization = req.headers[AUTHORIZATION_HEADER_NAME];
    console.log("Authorization header:", authorization);

    if (authorization) {
        let tokenParts = authorization.split(tokenSplitBy);
        console.log("Token parts:", tokenParts);

        let length = tokenParts.length;
        if (length == tokenLength) {
            let accessToken = tokenParts[1];
            console.log("Access token:", accessToken);

            try {
                let decoded = await auth.verifyToken(accessToken);
                console.log("Decoded token:", decoded);

                const email = decoded.email;
                const userId = decoded.userId;
                console.log("Decoded email:", email);
                console.log("Decoded userId:", userId);

                const user = await User.findOne({ _id: userId, token: accessToken }).lean();
                console.log("User found in DB:", user);

                if (user) {
                    logger.log(level.debug, `Token exists in the database for userId: ${userId}`);
                } else {
                    console.log(`Token does not exist in the database for userId: ${userId}`);
                    return unauthorizedError(res, messages.not_exist.replace("{dynamic}", "AccessToken"));
                }

                req[CURRENT_USER] = email;
                req[CURRENT_USER_ID] = userId;
                next();
                return;
            } catch (e) {
                console.log("Error in authMiddleware:", e);
                logger.log(level.error, `authMiddleware Error: ${e}`);
            }
        }
    }
    console.log("Authorization failed, returning unauthorized error");
    return unauthorizedError(res);
};

export const verifyMiddleware = async (req, res, next) => {
    console.log("verifyMiddleware invoked");

    const verifyToken = req.headers[VERIFICATION_HEADER_NAME];
    console.log("Verification header received:", verifyToken);

    if (verifyToken != constants.VERIFICATION_TOKEN) {
        console.log("Invalid or missing verification token");
        logger.log(level.error, `verifyMiddleware missing verification header error`);
        return unauthorizedError(res, 'Invalid or Missing Static Token');
    }
    console.log("Verification passed, proceeding to next middleware");
    next();
};

const requireAuth = (method, pathName) => {
    console.log(`Checking if auth is required for method: ${method}, path: ${pathName}`);
    const found = _.find(SKIP_AUTH_FOR, (o) => {
        return o.method == method && o.pathName == pathName;
    });
    console.log(`Auth required: ${found == undefined ? true : false}`);
    return found == undefined ? true : false;
};
