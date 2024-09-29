import HTTPStatus from 'http-status';
import { logger, level } from '../config/logger.js';
import JWTAuth from '../shared/services/jwt_auth/jwt_auth.service.js';
import pkg from 'lodash';
import {
  SendEmail,
  decrypt,
  encrypt,
  beautify,
  internalServerError,
  paramMissingError,
  badRequestError,
  okResponse,
  generateRandomString,
  makeid,
  makeNumericId,
  toObjectId,
} from '../shared/utils/utility.js';
import { REGEX } from '../shared/constant/application.const.js';
import User from '../models/user.model.js';
import Payment from '../models/payment.model.js';
import {
  constants as APP_CONST,
  UPLOAD_PATH,
} from '../shared/constant/application.const.js';
import messages from '../shared/constant/messages.const.js';
import moment from 'moment';
import UserToken from '../models/user_token.model.js';
import {
  returnOnExist,
  returnOnNotExist,
} from '../shared/services/database/query.service.js';
import {
  COUPON_FOR_WHO,
  COUPON_TYPE,
  IMAGE_EXTENSIONS,
  TYPES,
  USER_PRO_STATUS,
  USER_ROLE,
} from '../shared/constant/types.const.js';
import Path from 'path';
import {
  getSignedUrl,
  removeFileFromS3,
  uploadFileToS3,
} from '../shared/services/file-upload/aws-s3.service.js';
import Coupon from '../models/coupon.model.js';
import Stripe from "stripe";
import TrialUsers from "../models/trialUser.model.js";

const { _ } = pkg;
const auth = new JWTAuth();
const asset_url = `${APP_CONST.ASSET_URL}`;

export const login = async (req, res) => {
  try {
    let data = req.body;

    logger.log(level.info, `Login Data: ${beautify(data)}`);
    console.log("Login data received:", data);

    if (!data.device_id || !data.device_token || !data.device_type) {
      logger.log(level.info, 'login device info missing error');
      return paramMissingError(
        res,
        messages.missing_key.replace(
          '{dynamic}',
          'device_id Or device_token Or device_type'
        ),
        null
      );
    }

    console.log("Login type:", data.login_type);

    if (data.login_type == TYPES.LOGIN_TYPE_NORMAL) {
      /* Normal login */
      if (!data.phone_number) {
        if (!data.email) {
          return paramMissingError(
            res,
            messages.missing_key.replace('{dynamic}', 'Email')
          );
        }
        // if (!data.password) {
        //   return paramMissingError(
        //     res,
        //     messages.missing_key.replace('{dynamic}', 'Password')
        //   );
        // }
      }

      const filter = {};
      if (data.phone_number) {
        filter['phone_number'] = data.phone_number;
      } else if (data.email) {
        filter['email'] = data.email;
        filter['password'] = data.password;
      } else {
        return paramMissingError(
          res,
          messages.missing_key.replace('{dynamic}', 'Email | Phone Number')
        );
      }
      console.log("Filter for user existence:", filter);

      let userDoc = await userExist(filter);
      console.log("User document found:", userDoc);

      if (userDoc.length > 0) {
        let paymentDoc = await paymentExists(userDoc[0]._id);
        console.log("Payment document found:", paymentDoc);

        generateToken(res, data.email , userDoc[0], paymentDoc); // data.email|| data.password
        await addOrUpdateDeviceTokens(userDoc[0]._id, data);
      } else {
        console.log("User not found, returning error.");
        return badRequestError(
          res,
          data.phone_number ? messages.user_missing : messages.email_password_not_match,
          null,
          HTTPStatus.NOT_FOUND
        );
      }
    } 
    else if(data.login_type == TYPES.LOGIN_TYPE_GOOGLE || data.login_type == TYPES.LOGIN_TYPE_FACEBOOK || data.login_type == TYPES.LOGIN_TYPE_FACEBOOK || data.login_type == TYPES.LOGIN_TYPE_APPLE ) {
      /* Social login */
      const filter = { social_id: data.social_id };
      if (data.email) filter['email'] = data.email;
      console.log("Filter for social login:", filter);

      let userDoc = await userExist(filter);
      console.log("User document found for social login:", userDoc);

      if (userDoc.length > 0) {
        let paymentDoc = await paymentExists(userDoc[0]._id);
        console.log("Payment document found for social login:", paymentDoc);

        generateToken(res, data['email'] || null, userDoc[0], paymentDoc);
        await addOrUpdateDeviceTokens(userDoc[0]._id, data);
      } else {
        if (data?.email) {
          const isNormalEmailExist = await User.isExist({
            email: data.email,
            login_type: TYPES.LOGIN_TYPE_NORMAL,
          });
          console.log("Normal email existence check:", isNormalEmailExist);

          if (isNormalEmailExist) {
            return badRequestError(res, messages.email_is_already_in_use);
          }
        }

        let newUser = createNewUser({
          is_verified: true,
          name: data.name || '',
          login_type: data.login_type,
          email: data?.email || '',
          social_id: data.social_id,
          password: encrypt(`${data?.email || ''}_${data.social_id}`),
          role: data?.role || USER_ROLE.PATIENT,
          is_doctor_consulted: data?.is_doctor_consulted,
          doctor_suggestion: data?.doctor_suggestion,
          userTrial: false,
        });

        console.log("New user to be added:", newUser);

        userDoc = await User.add(newUser);
        console.log("Newly added user document:", userDoc);

        let paymentDoc = await paymentExists(userDoc._id);
        let freeTrialUserDoc={};
        generateToken(res, userDoc?.email | '', userDoc, paymentDoc, freeTrialUserDoc);
        await addOrUpdateDeviceTokens(userDoc._id, data);
      }
    }
    else {
      console.log("Invalid login type detected:", data.login_type);
      return badRequestError(res, messages.invalid_key.replace("{dynamic}", "Invalid Login Type Please check your login type"));
    }
  } catch (error) {
    logger.log(
      level.error,
      `Login : Internal server error : ${beautify(error.message)}`
    );
    console.log("Internal server error during login:", error.message);
    return internalServerError(res, error.message);
  }
};

export const logout = async (req, res) => {
  try {
    let data = req.body;
    logger.log(level.info, `Logout Data: ${beautify(data)}`);
    console.log("Logout data received:", data);

    if (!data.device_id || !data.user_id) {
      logger.log(level.info, 'logout device info missing error');
      return paramMissingError(
        res,
        messages.missing_key.replace(
          '{dynamic}',
          'device_id Or device_token Or device_type'
        ),
        null
      );
    }

    const deletedCondition = {
      $or: [{ is_loggedOut: false }, { is_loggedOut: { $exists: false } }],
    };
    const filter = {
      user_id: data.user_id,
      device_id: data.device_id,
      ...deletedCondition,
    };

    console.log("Filter for logout:", filter);

    const user = await UserToken.update(filter, {
      is_loggedOut: true,
      loggedOut_at: new Date().toISOString(),
    });

    console.log("Logout update result:", user);

    return okResponse(
      res,
      messages.updated.replace('{dynamic}', 'log out'),
      user
    );
  } catch (error) {
    logger.log(
      level.error,
      `Logout : Internal server error : ${beautify(error.message)}`
    );
    console.log("Internal server error during logout:", error.message);
    return internalServerError(res, error.message);
  }
};

export const signUp = async (req, res) => {
  try {
    const { body, file } = req;
    let data = body;
    let newUser = {
      name: data.name,
      email: data.email,
      phone_number: data.phone_number,
      //password: data.password,
      address: data.address,
      city: data.city,
      state: data.state,
      country: data.country,
      countryCode: data.countryCode,
      zipcode: data.zipcode,
      dob: data.dob,
      gender: data.gender,
      role: data?.role || USER_ROLE.PATIENT,
      is_doctor_consulted: data?.is_doctor_consulted,
      doctor_suggestion: data?.doctor_suggestion || [],
      is_verified: data.phone_number ? true : false,
      is_deleted: false,
      userTrial: false,
    };

    logger.log(level.info, `User Registration Body: ${beautify(data)}`);
    console.log("Signup data received:", data);

    if (!data.device_id || !data.device_token || !data.device_type || !data.login_type) {
      logger.log(level.info, 'signup device info missing error');
      return paramMissingError(
        res,
        messages.missing_key.replace(
          '{dynamic}',
          'device_id Or device_token Or device_type Or login_type'
        ),
        null
      );
    }

    console.log("Signup login type:", data.login_type);

    if (data.login_type == TYPES.LOGIN_TYPE_NORMAL) {
      if (!data.phone_number) {
        if (!data.email) {
          logger.log(level.error, 'User Registration: no email error');
          return paramMissingError(
            res,
            messages.missing_key.replace('{dynamic}', 'Email')
          );
        }
        if (!data.email & !data.phone_number) {
          logger.log(
            level.error,
            'User Registration: no email or phone number error'
          );
          return paramMissingError(
            res,
            messages.missing_key.replace('{dynamic}', 'Email | Phone Number')
          );
        }
      } else {
        if (!data.countryCode) {
          logger.log(level.error, 'User Registration: no Countrycode error');
          return paramMissingError(
            res,
            messages.missing_key.replace('{dynamic}', 'country code')
          );
        }
      }

      if (file) {
        const filePath = Path.parse(file.originalname);
        if (!Object.values(IMAGE_EXTENSIONS).includes(filePath.ext)) {
          logger.log(
            level.info,
            'User Registration: invalid file selection error'
          );
          return badRequestError(res, messages.invalid_file_selected);
        }
      }

      let filter = {};
      data.email ? (filter['email'] = data.email) : null;
      data.phone_number ? (filter['phone_number'] = data.phone_number) : null;
      data.email && data.phone_number ? (filter = {$or: [{ email: data.email }, { phone_number: data.phone_number }]}) : null;
      filter = {...filter, $or: [{ is_deleted: false }, { is_deleted: { $exists: false } }]};

      logger.log(level.info, `Signup UserFilter: ${beautify(filter)}`);
      console.log("Signup filter created:", filter);

      let userDoc = await userExist(filter);
      console.log("Signup user document found:", userDoc);

      if (userDoc.length > 0) {
        if (userDoc[0].login_type === Number(data.login_type)) {
          let userDocs = await User.update({ _id: userDoc[0]._id }, { is_signup: false });
          let paymentDoc = await paymentExists(userDoc[0]._id);

          console.log("Signup update result:", userDocs);
          console.log("Signup payment document:", paymentDoc);

          if (userDoc[0].email) {
            const OTP = await makeNumericId(6);
            logger.log(level.info, `Signup generated OTP=${OTP}`);
            await User.update({ _id: userDoc[0]._id }, { confirmation_otp: OTP });
            await SendEmail(
              userDoc[0].email,
              'login_verification',
              OTP,
              userDoc[0]?.name || 'There'
            );
          }
          delete userDoc[0]['confirmation_otp'];
          generateToken(res, data.email , userDocs, paymentDoc);
          await addOrUpdateDeviceTokens(userDoc[0]._id, data);
        } else {
          return badRequestError(res, messages.email_is_already_in_use_with_other_social_account);
        }
      } else {
        let freeTrialUserDoc={};
        User.add(newUser, freeTrialUserDoc).then(
          async (resp) => {
            if (file) {
              const filePath = Path.parse(file.originalname);
              const fileName = generateRandomString();
              const s3Location = `${UPLOAD_PATH.Profile}${resp._id}/${fileName}${filePath.ext}`;
              uploadFileAndUpdateProfileURL(s3Location, file, { _id: resp._id });
              resp['profile_image'] = await getSignedUrl(
                process.env.Aws_Bucket_Name,
                s3Location
              );
            }
            addOrUpdateDeviceTokens(resp._id, data);
            if (resp.email) {
              const OTP = await makeNumericId(6);
              logger.log(level.info, `Signup generated OTP=${OTP}`);
              await User.update({ _id: resp._id }, { confirmation_otp: OTP });
              await SendEmail(
                resp.email,
                'verification',
                OTP,
                resp?.name || 'There'
              );
            }
            delete resp['confirmation_otp'];
            generateToken(res, data.email || data.phone_number, resp);
          },
          (error) => {
            logger.log(
              level.error,
              `User Registration Error : ${beautify(error.message)}`
            );
            console.log("Error during signup:", error.message);
            return internalServerError(res, error);
          }
        );
      }          
    } else if(data.login_type == TYPES.LOGIN_TYPE_GOOGLE || data.login_type == TYPES.LOGIN_TYPE_FACEBOOK || data.login_type == TYPES.LOGIN_TYPE_FACEBOOK || data.login_type == TYPES.LOGIN_TYPE_APPLE ) {
      if (!data.social_id) {
        logger.log(level.info, 'signup device info missing error');
        return paramMissingError(res, messages.missing_key.replace('{dynamic}', 'social_id'), null);
      }

      const filter = { social_id: data.social_id };
      if (data.email) filter['email'] = data.email;
      console.log("Filter for social signup:", filter);

      let userDoc = await userExist(filter);
      console.log("User document found for social signup:", userDoc);

      if (userDoc.length > 0) {
        if (userDoc[0].login_type === Number(data.login_type)) {
          let userDocs = await User.update({ _id: userDoc[0]._id }, { is_signup: false });
          let paymentDoc = await paymentExists(userDoc[0]._id);
          console.log("Social signup update result:", userDocs);
          console.log("Social signup payment document:", paymentDoc);

          generateToken(res, data['email'] || null, userDocs, paymentDoc);
          await addOrUpdateDeviceTokens(userDoc[0]._id, data);
        } else {
          return badRequestError(res, messages.email_is_already_in_use_with_other_social_account);
        }
      } else {
        if (data?.email) {
          const isNormalEmailExist = await User.isExist({
            email: data.email,
            login_type: TYPES.LOGIN_TYPE_NORMAL,
          });
          console.log("Normal email existence check:", isNormalEmailExist);

          if (isNormalEmailExist) {
            return badRequestError(res, messages.email_is_already_in_use);
          }
        }

        let newUser = createNewUser({
          is_verified: true,
          name: data.name || '',
          login_type: data.login_type,
          email: data?.email || '',
          social_id: data.social_id,
          password: encrypt(`${data?.email || ''}_${data.social_id}`),
          role: data?.role || USER_ROLE.PATIENT,
          is_doctor_consulted: data?.is_doctor_consulted,
          doctor_suggestion: data?.doctor_suggestion,
          userTrial: false,
        });

        console.log("New social signup user to be added:", newUser);

        userDoc = await User.add(newUser);
        console.log("Newly added social signup user document:", userDoc);

        let paymentDoc = await paymentExists(userDoc._id);
        let freeTrialUserDoc={};
        generateToken(res, userDoc?.email | '', userDoc, paymentDoc,freeTrialUserDoc);
        await addOrUpdateDeviceTokens(userDoc._id, data);
      }    
    } else {
      console.log("Invalid login type for signup detected:", data.login_type);
      return badRequestError(res, messages.invalid_key.replace("{dynamic}", "Invalid Login Type Please check your login type"));
    }
  } catch (error) {
    logger.log(
      level.error,
      `User Registration Error Error=${beautify(error.message)}`
    );
    console.log("Internal server error during signup:", error.message);
    return internalServerError(res, error);
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    logger.log(level.info, `VerifyOTP otp=${otp}`);
    console.log("Verify OTP request:", { email, otp });

    if (!otp) {
      logger.log(level.error, 'VerifyOTP: no OTP found error');
      return paramMissingError(
        res,
        messages.missing_key.replace('{dynamic}', 'One Time Password')
      );
    }

    const filter = {
      email: email,
      login_type: TYPES.LOGIN_TYPE_NORMAL,
      confirmation_otp: otp,
    };
    console.log("Filter for OTP verification:", filter);

    const [user] = await User.get({
      email: email,
      login_type: TYPES.LOGIN_TYPE_NORMAL,
    });
    const [user_with_otp] = await User.get(filter);
    logger.log(
      level.info,
      `Verify OTP User: ${beautify(user)} user_with_otp: ${beautify(user_with_otp)}`
    );
    console.log("User found for OTP verification:", user);
    console.log("User found with OTP:", user_with_otp);

    const updated = await User.update(filter, {
      is_verified: true,
      confirmation_otp: null,
    });
    console.log("User verification update result:", updated);

    if (updated) {
      return okResponse(res, messages.user_verified_success);
    } else {
      return badRequestError(res, messages.otp_expired);
    }
  } catch (error) {
    logger.log(level.error, `VerifyOTP Error=${error.message}`);
    console.log("Internal server error during OTP verification:", error.message);
    return internalServerError(res, error);
  }
};

export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    logger.log(level.info, `Resend OTP email=${email}`);
    console.log("Resend OTP request for email:", email);

    const filter = { email, login_type: TYPES.LOGIN_TYPE_NORMAL };
    console.log("Filter for resending OTP:", filter);

    const notExist = await returnOnNotExist(
      User,
      filter,
      res,
      'User',
      messages.not_exist.replace('{dynamic}', 'User')
    );
    if (notExist) return;

    const [user] = await User.get(filter);
    const OTP = await makeNumericId(6);
    console.log("Generated OTP for resend:", OTP);

    await User.update(filter, { confirmation_otp: OTP });
    await SendEmail(email, 'verification', OTP, user?.name || 'There');

    return okResponse(res, messages.email_sent);
  } catch (error) {
    logger.log(level.error, `Resend OTP Error=${error.message}`);
    console.log("Internal server error during resending OTP:", error.message);
    return internalServerError(res, error);
  }
};

export const updateUserDetail = async (req, res, next) => {
  try {
    const { body, file } = req;
    const {
      name = null,
      address = null,
      city = null,
      state = null,
      country = null,
      countryCode = null,
      zipcode = null,
      dob = null,
      gender = null,
    } = body;

    logger.log(level.info, `updateUserDetail body=${beautify(body)}`);
    console.log("Update user detail request body:", body);

    const payload = {};
    if (name) payload['name'] = name;
    if (address) payload['address'] = address;
    if (city) payload['city'] = city;
    if (state) payload['state'] = state;
    if (country) payload['country'] = country;
    if (countryCode) payload['countryCode'] = countryCode;
    if (zipcode) payload['zipcode'] = zipcode;
    if (dob) payload['dob'] = dob;
    if (gender) payload['gender'] = gender;

    const filter = { _id: req['currentUserId'] };
    console.log("Filter for updating user detail:", filter);

    const user = await User.update(filter, payload);
    console.log("Update user detail result:", user);

    let s3Location;
    if (file) {
      const filePath = Path.parse(file.originalname);
      const fileName = generateRandomString();
      s3Location = `${UPLOAD_PATH.Profile}${req['currentUserId']}/${fileName}${filePath.ext}`;

      if (!Object.values(IMAGE_EXTENSIONS).includes(filePath.ext)) {
        logger.log(
          level.info,
          'updateUserDetail: invalid file selection error'
        );
        console.log("Invalid file selected for user update:", filePath.ext);
        return badRequestError(res, messages.invalid_file_selected);
      }

      const [user] = await User.get(filter);
      console.log("User found for updating profile image:", user);

      if (user && user.profile_image) {
        removeFileFromS3(process.env.Aws_Bucket_Name, user.profile_image);
      }
      uploadFileAndUpdateProfileURL(s3Location, file, filter);
    }

    if (s3Location) {
      user['profile_image'] = await getSignedUrl(
        process.env.Aws_Bucket_Name,
        s3Location
      );
    }

    return await okResponse(
      res,
      messages.updated.replace('{dynamic}', 'User'),
      user
    );
  } catch (error) {
    logger.log(
      level.error,
      `updateUserDetail Error: ${beautify(error.message)}`
    );
    console.log("Internal server error during updating user detail:", error.message);
    return internalServerError(res, error);
  }
};

export const forgotPassword = async (req, res) => {
  try {
    let data = req.body;
    logger.log(level.info, `Forgot Password Body : ${beautify(data)}`);
    console.log("Forgot password request body:", data);

    let userData = await userExist({ email: data.email });
    logger.log(
      level.info,
      `Forgot Password userData: ${beautify(userData)} name: ${userData[0]?.name}`
    );
    console.log("User data found for forgot password:", userData);

    if (userData.length > 0) {
      const mail = await SendEmail(
        data.email || userData.email,
        'forgot_password',
        null,
        userData[0]?.name || 'There'
      );
      console.log("Email sent for forgot password:", mail);

      if (mail) {
        const random_string = mail;
        var insertMailId = {
          random_string: random_string,
        };
        await User.update(
          { email: data.email || userData.email },
          insertMailId
        );
      }
      return okResponse(res, messages.email_sent, null);
    } else {
      console.log("User not found for forgot password.");
      return badRequestError(
        res,
        messages.user_missing,
        null,
        HTTPStatus.NOT_FOUND
      );
    }
  } catch (error) {
    logger.log(level.error, `Forgot Password Error=${beautify(error.message)}`);
    console.log("Internal server error during forgot password:", error.message);
    return internalServerError(res, error);
  }
};

export const phoneExists = async (req, res) => {
  try {
    var data = req.body;
    logger.log(level.info, `Phone Exists Body : ${beautify(data)}`);
    console.log("Phone exists request body:", data);

    var phone_valid = REGEX.phone_number;
    let phone = phone_valid.test(data.phone);

    var country_code = REGEX.country_code;
    let cc = country_code.test(data.country_code);

    if (!phone || !cc) {
      console.log("Invalid phone number or country code.");
      return badRequestError(
        res,
        messages.invalid_key.replace('{dynamic}', 'Phone Number')
      );
    }

    const filter = { phone_number: data.phone, countryCode: data.country_code, is_deleted: false };
    console.log("Filter for checking phone existence:", filter);

    let [userDoc] = await User.get(filter);
    console.log("User document found for phone existence check:", userDoc);

    if (userDoc) {
      return okResponse(res, messages.phone_exists, true);
    } else {
      return okResponse(
        res,
        messages.not_exist.replace('{dynamic}', 'Phone Number'),
        false
      );
    }
  } catch (error) {
    logger.log(level.error, `Phone Exists Error=${beautify(error.message)}`);
    console.log("Internal server error during phone existence check:", error.message);
    return internalServerError(res, error);
  }
};

export const getUserByID = async (req, res) => {
  try {
    var query_params = req.query;
    logger.log(level.info, `Get User By ID Body : ${beautify(query_params)}`);
    console.log("Get user by ID request query params:", query_params);

    const deletedCondition = { $or: [{ is_deleted: false }, { is_deleted: { $exists: false } }] };
    const filter = { _id: query_params.id, ...deletedCondition };
    console.log("Filter for getting user by ID:", filter);

    const notExist = await returnOnNotExist(User, filter, res, "User", messages.not_exist.replace("{dynamic}", "User"));
    if (notExist) return;

    let [userData] = await userExist({ _id: query_params.id });
    console.log("User data found by ID:", userData);

    if (userData) {
      const user_id = userData._id;
      const access_token = userData.access_token;

      let paymentDoc = await paymentExists(user_id);
      console.log("Payment document found by user ID:", paymentDoc);

      const projection = { startTrial: 1, endTrial: 1 };

      const [TrialUser] = await TrialUsers.get({ user_id: user_id }, projection);
      let freeTrialUserDoc = {};

      if (TrialUser && Object.keys(TrialUser).length > 0) {
        freeTrialUserDoc = TrialUser;
      } else {
        freeTrialUserDoc = freeTrialUserDoc;
      }
      return okResponse(res, messages.user_found, { access_token: access_token, userDoc: userData, paymentDoc: paymentDoc, freeTrialUserDoc: freeTrialUserDoc });
    } else {
      console.log("User not found by ID.");
      return okResponse(res, messages.user_missing, null);
    }
  } catch (error) {
    logger.log(level.error, `Get User By ID Error=${beautify(error.message)}`);
    console.log("Internal server error during getting user by ID:", error.message);
    return internalServerError(res, error);
  }
};

export const resetPasswordCheckLink = async (req, res) => {
  try {
    const { email, mailid, time } = req.params;
    console.log("Reset password check link params:", { email, mailid, time });

    var isValid = await authUserForgotPasswordCheckEmail(email, mailid, time);
    console.log("Reset password check link validity:", isValid);

    if (isValid == true) {
      res.send({ code: 200 });
    } else {
      res.send({ code: 400 });
    }
  } catch (e) {
    console.log("Error during reset password check link:", e.message);
    res.send({ status: 400, error: e.message });
  }
};

export const updatePassword = async (req, res) => {
  try {
    const { email, password } = req.params;
    console.log("Update password params:", { email, password });

    var updated = await User.update({ email: decrypt(email) }, { password });
    console.log("Password update result:", updated);

    if (updated) {
      await User.update({ email: decrypt(email) }, { random_string: '' });
      res.send({ code: 200 });
    } else {
      res.send({ code: 400 });
    }
  } catch (e) {
    console.log("Error during password update:", e.message);
    res.send({ status: 400, error: e.message });
  }
};

/* Pages Redirection */

export const resetPasswordPage = async (req, res) => {
  console.log("Rendering reset password page.");
  res.render('change_password.ejs', {
    asset_url,
    apiURL: APP_CONST.API_URL,
  });
};

export const resetPasswordLinkExpirePage = async (req, res) => {
  console.log("Rendering reset password link expired page.");
  res.render('expired.ejs', { asset_url });
};

export const passwordUpdatedPage = async (req, res) => {
  console.log("Rendering password updated success page.");
  res.render('change_pass_success.ejs', { asset_url });
};

export const passwordUpdateFailedPage = async (req, res) => {
  console.log("Rendering password update failure page.");
  res.render('change_pass_failure.ejs', { asset_url });
};

/* Commonly used functions */

async function authUserForgotPasswordCheckEmail(
  email,
  random_string,
  timestamp
) {
  try {
    var emailId = await decrypt(email);
    console.log("Decrypted email for forgot password check:", emailId);

    let [email_with_string_exist] = await User.get({
      email: emailId,
      random_string: random_string,
    });
    console.log("Email with string exists check:", email_with_string_exist);

    logger.log(
      level.info,
      `user: ${emailId}, random_string: ${random_string}, email_with_string_exist: ${beautify(email_with_string_exist)}`
    );

    let date = new Date(parseInt(timestamp));
    var now = new Date();

    var ms = moment(now, 'YYYY-MM-DD HH:mm:ss').diff(
      moment(date, 'YYYY-MM-DD HH:mm:ss')
    );
    var data = moment.duration(ms);
    console.log("Duration data for forgot password check:", data);

    if (email_with_string_exist && data._data.days < 1) {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    logger.log(
      level.error,
      `Error in Check Mail: ${JSON.stringify(e.message)}`
    );
    console.log("Error in forgot password check email:", e.message);
    return false;
  }
}

async function generateToken(
  res,
  email,
  userDoc = null,
  paymentDoc = null
) {
  console.log("Generating token for user:", email);

  let doc = JSON.parse(JSON.stringify(userDoc));
  let payDoc = JSON.parse(JSON.stringify(paymentDoc));
  console.log("User document for token generation:", doc);
  console.log("Payment document for token generation:", payDoc);

  const accessToken = await auth.createToken(email, doc._id);
  console.log("Generated access token:", accessToken);

  delete doc?.password;
  await User.update({_id: doc._id}, {access_token: accessToken});

  if (doc && doc.trial_redeem_time) {
    doc = await updateUserPRODetails(doc);
  } else {
    doc[USER_PRO_STATUS.TRIAL] = false;
    doc[USER_PRO_STATUS.TRIAL_EXPIRED] = false;
  }
  delete doc['confirmation_otp'];

  const user_id = doc._id;
  const projection = { startTrial: 1, endTrial: 1 };
  const [TrialUser] = await TrialUsers.get({user_id:user_id}, projection);

  let freeTrialUserDoc={};
  if(TrialUser && Object.keys(TrialUser).length > 0){
    freeTrialUserDoc =TrialUser;
  }
  else{
    freeTrialUserDoc=freeTrialUserDoc;
  }

  console.log("Final user document for token response:", doc);
  console.log("Final payment document for token response:", payDoc);
  console.log("Free trial user document for token response:", freeTrialUserDoc);

  return okResponse(res, messages.login_success, {
    access_token: accessToken,
    userDoc: doc,
    paymentDoc: payDoc, 
    freeTrialUserDoc:freeTrialUserDoc
  });
}

async function updateUserPRODetails(userDoc) {
  const doc = JSON.parse(JSON.stringify(userDoc));
  const trialFilter = {
    user_id: doc._id,
    coupon_type: COUPON_TYPE.TRIAL_COUPON,
    coupon_for: COUPON_FOR_WHO.SINGLE_USER,
    is_deleted: false,
  };

  logger.log(
    level.info,
    `update User's pro details : ${beautify(doc)} CouponFilter: ${beautify(trialFilter)}`
  );
  console.log("Trial filter for updating PRO details:", trialFilter);

  const [coupon] = await Coupon.get(trialFilter);
  console.log("Coupon found for updating PRO details:", coupon);

  if (coupon) {
    let date = new Date(doc.trial_redeem_time);
    var now = new Date();

    var ms = moment(now, 'YYYY-MM-DD HH:mm:ss').diff(
      moment(date, 'YYYY-MM-DD HH:mm:ss')
    );
    var data = moment.duration(ms);
    console.log("Duration data for updating PRO details:", data);

    if (data._data.days <= coupon.expire_time) {
      doc[USER_PRO_STATUS.TRIAL] = true;
      doc[USER_PRO_STATUS.TRIAL_EXPIRED] = false;
    } else {
      doc[USER_PRO_STATUS.TRIAL] = false;
      doc[USER_PRO_STATUS.TRIAL_EXPIRED] = true;
    }
  } else {
    // Coupon not generated yet
    doc[USER_PRO_STATUS.TRIAL] = false;
    doc[USER_PRO_STATUS.TRIAL_EXPIRED] = false;
  }
  return { ...doc };
}

export const checkForTrialEnd = async (req, res) => {
  try {
    let doc = await User.get({ _id: toObjectId(req['currentUserId']) });
    let userDoc = doc.length > 0 ? JSON.parse(JSON.stringify(doc[0])) : null;

    console.log("User document for trial end check:", userDoc);

    if (userDoc && userDoc.trial_redeem_time) {
      userDoc = await updateUserPRODetails(userDoc);
    } else {
      // Trial not started yet
      userDoc[USER_PRO_STATUS.TRIAL] = false;
      userDoc[USER_PRO_STATUS.TRIAL_EXPIRED] = false;
    }
    return okResponse(res, messages.trial_not_exceeded, { ...userDoc });
  } catch (error) {
    logger.log(
      level.error,
      `Check For Trial End Error=${beautify(error.message)}`
    );
    console.log("Internal server error during trial end check:", error.message);
    return internalServerError(res, error);
  }
};

function createNewUser(userData) {
  console.log("Creating new user with data:", userData);
  return {
    email: userData.email,
    name: userData.name,
    login_type: userData.login_type,
    status: 1,
    is_verified: userData.is_verified,
    social_id: userData.social_id,
    password: userData.password,
    access_token: userData.access_token,
    profile_image: userData.profile_image,
    role: userData.role,
    is_doctor_consulted: userData.is_doctor_consulted,
    doctor_suggestion: userData.doctor_suggestion || [],
    userTrial: userData.userTrial,
  };
}

async function userExist(filter) {
  console.log("Checking if user exists with filter:", filter);
  let userDoc = await User.get({
    ...filter,
    $or: [{ is_deleted: false }, { is_deleted: { $exists: false } }],
  });
  console.log("User existence check result:", userDoc);
  return userDoc || [];
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function paymentExists(user_id) {
  console.log("Checking if payment exists for user ID:", user_id);
  let paymentDoc = await Payment.get({
    user_id: user_id,
    $or: [{ is_deleted: false }, { is_deleted: { $exists: false } }],
  }, {}, {}, { path: "plan_type" });

  console.log("Payment document found:", paymentDoc);

  paymentDoc?.sort(function(a,b){
    return b.created_at - a.created_at;
  });
  let payload = {};
  if (paymentDoc.length > 0) {
    if (paymentDoc[0]?.is_schedule) {
      let price = {};
      let product;
      let productName;
      if (paymentDoc[0]?.priceId) {
        price = await stripe.prices.retrieve(paymentDoc[0]?.priceId);
        product = await stripe.products.retrieve(price?.product);
        productName = product.name;
      }
      payload = {
        googlePayId: null,
        applePayId: null,
        subscribeScheduleId : paymentDoc[0]?.subscribeScheduleId,
        priceId : paymentDoc[0]?.priceId,
        current_phase : paymentDoc[0]?.current_phase,
        planName: productName || ""
      }
    } else {
      if (paymentDoc[0]?.googlePayId || paymentDoc[0]?.applePayId) {
        let price = {};
        let product;
        let productName;
        if (paymentDoc[0]?.priceId) {
          price = await stripe.prices.retrieve(paymentDoc[0]?.priceId);
          product = await stripe.products.retrieve(price?.product);
          productName = product.name;
        }
        payload = {
          googlePayId: paymentDoc[0]?.googlePayId,
          applePayId: paymentDoc[0]?.applePayId,
          subscribeScheduleId: null,
          priceId: paymentDoc[0]?.priceId,
          current_phase: paymentDoc[0]?.current_phase,
          planName: productName || ""
        };

      } else {
        let price = {};
        let product;
        let productName;
        if (paymentDoc[0]?.priceId) {
          price = await stripe.prices.retrieve(paymentDoc[0]?.priceId);
          product = await stripe.products.retrieve(price?.product);
          productName = product.name;
        }
        payload = {}; 
      }
    }
  }
  console.log("Final payment document payload:", payload);
  return payload || {};
}

async function addOrUpdateDeviceTokens(user_id, data) {
  console.log("Adding or updating device tokens for user ID:", user_id);
  const userTokens = await UserToken.get({ user_id: user_id });
  console.log("User tokens found:", userTokens);

  for (const item of userTokens) {
    if (item.device_id !== data.device_id) {
      await UserToken.update(
        { _id: item?._id },
        {
          is_loggedOut: true,
          loggedOut_at: new Date().toISOString(),
        }
      );
    }
  }

  const deviceExist = await UserToken.get({
    user_id: user_id,
    device_id: data.device_id,
    is_deleted: false,
  });
  console.log("Device existence check result:", deviceExist);

  if (deviceExist.length) {
    await UserToken.update(
      { user_id, device_id: data.device_id, is_deleted: false },
      {
        device_token: data.device_token,
        is_loggedOut: false,
        loggedOut_at: new Date().toISOString(),
      }
    );
  } else {
    await UserToken.add({
      device_id: data.device_id,
      device_token: data.device_token,
      device_type: data.device_type,
      user_id: user_id,
    });
  }
}

async function uploadFileAndUpdateProfileURL(s3Location, file, filter) {
  console.log("Uploading file to S3 and updating profile URL:", s3Location);
  uploadFileToS3(process.env.Aws_Bucket_Name, s3Location, file).then(
    async (result) => {
      console.log("File uploaded to S3:", result);
      await User.update(filter, { profile_image: s3Location });
    },
    (err) => {
      logger.log(level.error, `updateUserDetail err=${beautify(err.message)}`);
      console.log("Error during S3 file upload:", err.message);
    }
  );
}

export const makePayment = async (request, response) => {
  try {
    let data = request.body;
    console.log("Make payment request body:", data);
  } catch (error) {
    console.log("Error during make payment:", error.message);
  }
};

