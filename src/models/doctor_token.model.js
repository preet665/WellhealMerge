import mongoose from "mongoose";
import { SchemaMethods } from "./../shared/services/database/schema_methods.service.js";

// Define the schema for DoctorToken
const doctorTokenSchema = new mongoose.Schema({
  doctor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
    trim: true,
  },
  device_id: {
    type: String,
    trim: true, // Make it optional
    default: null
  },
  device_token: {
    type: String,
    required: true,
    trim: true
  },
  device_type: {
    type: String, // "I": IOS, "A": Android
    trim: true, // Make it optional
    enum: ["I", "A", null],
    default: null
  },
  is_deleted: {
    type: Boolean,
    default: false
  },
  deleted_at: {
    type: Date,
    default: null
  },
  is_loggedOut: {
    type: Boolean,
    default: false
  },
  loggedOut_at: {
    type: Date,
    default: null
  }
});

// Create a model for the DoctorToken schema
const DoctorTokenModel = mongoose.model('DoctorToken', doctorTokenSchema);
SchemaMethods(DoctorTokenModel)
// Export the model to be used in other parts of the application
export default DoctorTokenModel;
