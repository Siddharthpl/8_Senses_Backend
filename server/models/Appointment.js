const mongoose = require("mongoose");

const AppointmentSchema = new mongoose.Schema(
  {
    // === Core Appointment Fields ===
    serviceType: {
      type: String,
      required: true,
      enum: ["assessment", "therapy", "consultation", "follow-up", "other"],
    },
    date: { 
      type: Date, 
      required: true 
    },
    timeSlot: { 
      type: String,
      required: function() { 
        return this.status === "confirmed";
      } 
    },
    status: {
      type: String,
      enum: ["requested", "confirmed", "completed", "cancelled", "no_show"],
      default: "requested",
    },

    // === Patient Information ===
    patient: {
      // For registered patients
      patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Patient",
      },
      // For new patients (when creating new patient during appointment)
      childName: {
        type: String,
        required: function () {
          return !this.patient.patientId;
        }
      },
      childDOB: { 
        type: Date,
        required: function() {
          return !this.patient.patientId;
        }
      },
      childGender: { 
        type: String, 
        enum: ["male", "female", "other"],
        required: function() {
          return !this.patient.patientId;
        }
      },
      birthCertificate: { 
        url: String, 
        public_id: String 
      },
      childPhoto: { 
        url: String, 
        public_id: String 
      },
    },

    // === Parent/Guardian Information (for new patients) ===
    parentInfo: {
      parentName: {
        type: String,
        required: function () {
          return !this.patient.patientId;
        }
      },
      contactNumber: { 
        type: String, 
        required: function() {
          return !this.patient.patientId;
        }
      },
      email: {
        type: String,
        match: [
          /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
          "Please add a valid email",
        ],
      },
      address: { 
        type: String,
        required: function() {
          return !this.patient.patientId;
        }
      },
      aadharCard: { 
        url: String, 
        public_id: String 
      },
      parentPhoto: { 
        url: String, 
        public_id: String 
      },
    },

    // === Medical Information ===
    medicalInfo: {
      primaryConcern: { 
        type: String,
        required: true
      },
      documents: [
        {
          url: String,
          public_id: String,
          name: String,
          uploadDate: { type: Date, default: Date.now },
        },
      ],
    },

    // === Assignment and Scheduling ===
    assignedTherapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function() {
        return this.status === "confirmed";
      }
    },

    // Record who confirmed/created the appointment
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    confirmedAt: {
      type: Date,
    },

    // === Payment Information ===
    payment: {
      amount: {
        type: Number,
        default: 0,
      },
      status: {
        type: String,
        enum: ["pending", "paid", "refunded", "failed"],
        default: "pending",
      },
      method: {
        type: String,
        enum: ["cash", "card", "online", "insurance", "credit_card", "not_specified"],
        default: "not_specified",
      },
      transactionId: {
        type: String,
      },
      paidAt: {
        type: Date,
      },
    },

    // === Additional Fields ===
    notes: { type: String },
    isDraft: {
      type: Boolean,
      default: false,
    },
    
    // Reference to public appointment if this was converted from a public request
    convertedFromPublicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PublicAppointment"
    }
  },
  {
    timestamps: true,
  }
);

// Validate for appointments with required information
AppointmentSchema.pre('validate', function(next) {
  // Validate that either registered patient or new patient info is provided
  if (!this.patient.patientId && !this.patient.childName) {
    this.invalidate("patient", "Either patientId (registered) or childName (new) is required");
  }
  
  // Validate for confirmed appointments
  if (this.status === "confirmed" && !this.assignedTherapist) {
    this.invalidate("assignedTherapist", "A therapist must be assigned for confirmed appointments");
  }
  
  next();
});

module.exports = mongoose.model("Appointment", AppointmentSchema);