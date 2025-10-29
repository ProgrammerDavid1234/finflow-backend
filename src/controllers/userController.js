const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { validatePhoneNumber } = require('../utils/validators');

// Get user profile
// Get user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Format join date
    const joinedMonthYear = user.createdAt
      ? user.createdAt.toLocaleString('en-US', { month: 'long', year: 'numeric' })
      : null;

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        joined: joinedMonthYear, // <-- add this to response
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};


// Update user profile
exports.updateProfile = async (req, res) => {
    try {
        const { fullName, phoneNumber, profileImage, currency } = req.body;

        const updateData = {};
        if (fullName !== undefined) updateData.fullName = fullName;
        if (phoneNumber !== undefined) {
            if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
                return res.status(400).json({ error: 'Invalid phone number format' });
            }
            updateData.phoneNumber = phoneNumber;
        }
        if (profileImage !== undefined) updateData.profileImage = profileImage;
        if (currency !== undefined) updateData.currency = currency;

        const user = await User.findByIdAndUpdate(
            req.userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user,
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Both passwords are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.userId);
        
        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash and update new password
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully',
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get user balance
exports.getBalance = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('balance currency');
        res.json({
            success: true,
            balance: user.balance,
            currency: user.currency,
        });
    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};