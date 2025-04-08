const mongoose = require("mongoose");

const AppointmentSchema = new mongoose.Schema({
  // Common Fields (both user and receptionist)
  serviceType: {
    type: String,
    required: true,
    enum: ["assessment", "therapy", "consultation", "follow-up"]
  },
  preferredDate: {
    type: Date,
    required: true
  },
  preferredTime: {
    type: String,
    required: true
  },
  specialNeeds: String,
  paymentMethod: {
    type: String,
    enum: ["credit_card", "debit_card", "cash", "insurance", "pending"],
    default: "pending"
  },
  status: {
    type: String,
    enum: ["requested", "confirmed", "completed", "cancelled", "no_show"],
    default: "requested"
  },

  // User-side specific fields (unauthenticated)
  parentDetails: {
    motherName: String,
    fatherName: String,
    childName: {
      type: String,
      required: function() { return this.isPublicSubmission; }
    },
    contactNumber: {
      type: String,
      required: function() { return this.isPublicSubmission; }
    },
    email: {
      type: String,
      required: function() { return this.isPublicSubmission; }
    },
    childAge: Number,
    childGender: String
  },

  // Receptionist-side specific fields
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient"
  },
  assignedTherapist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  confirmedDateTime: Date,
  notes: String,
  documents: [String],

  // System fields
  isPublicSubmission: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add conditional validation
AppointmentSchema.pre("validate", function(next) {
  if (this.isPublicSubmission && !this.parentDetails.childName) {
    this.invalidate("parentDetails.childName", "Child's name is required");
  }
  next();
});