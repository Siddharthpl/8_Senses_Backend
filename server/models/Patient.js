const mongoose = require("mongoose");

const PatientSchema = new mongoose.Schema(
  {
    // Child's Information
    childName: {
      type: String,
      required: [true, "Please provide child's full name"],
      trim: true
    },
    childDOB: {
      type: Date,
      required: [true, "Please provide date of birth"]
    },
    childGender: {
      type: String,
      required: [true, "Please provide gender"],
      enum: ["male", "female", "other"]
    },
    age: {
      type: Number
    },
    childPhoto: {
      type: String, // URL from file upload API
      default: ""
    },
    birthCertificate: {
      type: String, // URL from file upload API
      default: ""
    },

    // Parent's Information
    parentName: {
      type: String,
      required: [true, "Please provide parent/guardian name"],
      trim: true
    },
    contactNumber: {
      type: String,
      required: [true, "Please provide contact number"],
      match: [/^[0-9]{10}$/, "Please enter a valid 10-digit phone number"]
    },
    email: {
      type: String,
      required: [true, "Please provide email address"],
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email"
      ]
    },
    parentPhoto: {
      type: String, // URL from file upload API
      default: ""
    },
    address: {
      type: String,
      required: [true, "Please provide address"]
    },
    aadharCard: {
      type: String, // URL from file upload API
      default: ""
    },

    // Status and Metadata
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },
    lastAppointment: {
      type: Date
    },
    nextAppointment: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Calculate age before saving
PatientSchema.pre('save', function(next) {
  if (this.childDOB) {
    const today = new Date();
    const birthDate = new Date(this.childDOB);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    this.age = age;
  }
  next();
});

module.exports = mongoose.model("Patient", PatientSchema);
