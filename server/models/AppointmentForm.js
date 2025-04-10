const mongoose = require('mongoose');

const appointmentFormSchema = new mongoose.Schema({
  motherName: {
    type: String,
    required: [true, 'Mother\'s name is required']
  },
  fatherName: {
    type: String,
    required: [true, 'Father\'s name is required']
  },
  childName: {
    type: String,
    required: [true, 'Child\'s name is required']
  },
  contactNumber: {
    type: String,
    required: [true, 'Contact number is required'],
    match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  childAge: {
    type: String,
    required: [true, 'Child\'s age is required']
  },
  serviceType: {
    type: String,
    required: [true, 'Service type is required'],
    enum: ['assessment', 'therapy', 'consultation', 'follow-up', 'other']
  },
  preferredDate: {
    type: Date,
    required: [true, 'Preferred date is required']
  },
  preferredTime: {
    type: String,
    required: [true, 'Preferred time is required']
  },
  specialNeeds: {
    type: String,
    required: false
  },
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: ['credit_card', 'debit_card']
  },
  status: {
    type: String,
    enum: ['pending', 'processed', 'cancelled'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AppointmentForm', appointmentFormSchema); 