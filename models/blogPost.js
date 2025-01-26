const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const BlogPost = sequelize.define(
  "BlogPost",
  {
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    author: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt
    createdAt: "created_at",
    updatedAt: false, // Disable updatedAt
  },
);

module.exports = BlogPost;
