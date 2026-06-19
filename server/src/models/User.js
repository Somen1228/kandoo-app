import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  firebase_uid: { type: DataTypes.STRING(128), allowNull: false, unique: true },
  email: { type: DataTypes.STRING(255), allowNull: true },
  phone: { type: DataTypes.STRING(32), allowNull: true },
  display_name: { type: DataTypes.STRING(255), allowNull: true },
  photo_url: { type: DataTypes.TEXT, allowNull: true },
  auth_provider: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'email' },
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
});

export default User;
