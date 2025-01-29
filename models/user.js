const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: {
          msg: "Must be a valid email address",
        },
      },
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      collate: "NOCASE", // Enforce case-insensitive uniqueness
      validate: {
        len: {
          args: [3, 30],
          msg: "Username must be between 3 and 30 characters.",
        },
        is: {
          args: /^[a-zA-Z0-9_]+$/i,
          msg: "Username can only contain letters, numbers, and underscores.",
        },
      },
    },
    password: {
      type: DataTypes.STRING, // Hashed password
      allowNull: false,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
    indexes: [
      {
        unique: true,
        fields: ["username"],
        // For SQLite, the 'collate' is already set in the field definition
      },
    ],
  },
);

module.exports = User;
