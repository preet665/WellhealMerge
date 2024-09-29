import mongoose from "mongoose";
import { GENDER, TYPES, USER_ROLE } from "../shared/constant/types.const.js";
import { signURL } from "../shared/services/file-upload/aws-s3.service.js";
import DBOperation from "./../shared/services/database/database_operation.service.js";
import {SchemaMethods} from "./../shared/services/database/schema_methods.service.js";
import { encrypt, decrypt } from "./../shared/utils/utility.js";

// mongoose schema
const schema = {
  name: {
    type: String,
    trim: true,
    default: null,
  },
  email: {
    type: String,
    trim: true,
    set: encrypt,
    get: decrypt,
    default: null,
  },
  phone_number: {
    type: Number,
    required: false,
    trim: true,
    default: null,
  },
  password: {
    type: String,
    trim: true,
    required: false,
    select: false,
    default: null,
    set: encrypt,
    get: decrypt,
  },
  profile_image: {
    type: String,
    trim: true,
    default: "",
  },
  status: {
    type: Number, // 0: Inactive, 1: Active
    trim: true,
    required: true,
    default: 1,
  },
  login_type: {
    type: Number, // 0 : Normal, 1: Google, 2: Facebook, 3: Apple
    enum: Object.values(TYPES),
    trim: true,
    required: true,
    default: 0,
  },
  social_id: {
    type: String, // Social login's social id
    trim: true,
    default: null,
  },
  address: {
    type: String,
    trim: true,
    default: null,
  },
  city: {
    type: String,
    trim: true,
    default: null,
  },
  state: {
    type: String,
    trim: true,
    default: null,
  },
  country: {
    type: String,
    trim: true,
    default: null,
  },
  countryCode: {
    type: Number,
    trim: true,
    null: false,
    default: null,
  },
  zipcode: {
    type: Number,
    default: null,
  },
  Health_scores: {
    type: JSON,
    default: {},
  },
  fb_access_token: {
    type: String,
    trim: true,
    default: null,
  },
  is_verified: {
    type: Boolean,
    default: false,
  },
  dob: {
    type: String,
    required: false,
    default: null,
  },
  gender: {
    type: String,
    enum: [...Object.values(GENDER), null],
    default: null,
  },
  random_string: {
    type: String,
    default: null,
  },
  confirmation_otp: {
    type: String,
    trim: true,
    required: false,
    default: "",
    set: encrypt,
    get: decrypt,
  },
  is_splash_answered: {
    type: Boolean,
    default: false,
  },
  role: {
    type: Number,
    enum: [...Object.values(USER_ROLE)],
    required: true,
    default: USER_ROLE.PATIENT,
  },
  access_token: {
    type: String,
    trim: true,
    required: false,
    default: "",
    set: encrypt,
    get: decrypt,
  },
  customer_id: {
    type: String,
    required: false,
    default: "",
  },
  is_doctor_consulted: {
    type: Boolean,
    required: false,
    default: false,
  },
  is_trial_cancel: {
    type: Boolean,
    required: false,
    default: false,
  },
  is_plan_cancel: {
    type: Boolean,
    required: false,
    default: false,
  },
  is_trial_used: {
    type: Boolean,
    required: false,
    default: false,
  },
  is_trial_running: {
    type: Boolean,
    required: false,
    default: false,
  },
  is_plan_running: {
    type: Boolean,
    required: false,
    default: false,
  },
  doctor_suggestion: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubCategory",
    required: false,
  }],
  trial_redeem_time: {
    type: Date,
    default: null,
  },
  is_schedule: {
    type: Boolean,
    required: false,
    default: false,
  },
  is_deleted: {
    type: Boolean,
    default: false,
  },
  userTrial: {
    type: Boolean,
    trim: true,
    default: true,
  },
  is_signup: {
    type: Boolean,
    trim: true,
    default: true,
  },
  defaultPaymentMethodId: {
    type: Object,
    trim: true,
    default: null,
  },
  deleted_at: {
    type: Date,
    default: null,
  },
};

// Create Mongoose Schema
const UserSchema = new mongoose.Schema(schema);

// Adding custom methods to the schema
UserSchema.statics.get = async function(filter, projection = {}) {
  return this.find(filter, projection).lean();
};

UserSchema.statics.updateUser = async function(filter, update) {
  return this.updateOne(filter, update);
};

// Handle URL transformations as before
async function handleURL(values) {
  if (Array.isArray(values)) {
    await Promise.all(
      values.map(async (item) => {
        item.profile_image = await signURL(item.profile_image);
      })
    );
  } else if (values && typeof values === "object") {
    values.profile_image = await signURL(values.profile_image);
  }
  return values;
}
async function handleSingleURL(value) {
  if (!value) return;
  value["profile_image"] = await signURL(value.profile_image);
  return value;
}

UserSchema.post(["find", "update", "updateMany"], handleURL);
UserSchema.post("aggregate", handleURL);
UserSchema.post(["findOne", "findOneAndUpdate", "updateOne"], handleSingleURL);
UserSchema.post("save", handleSingleURL);

UserSchema.virtual("sub_category", {
  ref: "SubCategory",
  localField: "sub_category_id",
  foreignField: "_id",
});

// Create the Mongoose model
const UserModel = mongoose.model("User", UserSchema);
SchemaMethods(UserModel)
export default UserModel;
