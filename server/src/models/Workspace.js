import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

const Workspace = sequelize.define('Workspace', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: { model: User, key: 'id' },
    onDelete: 'CASCADE',
  },
  boards: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  client_updated_at: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'workspaces',
  timestamps: true,
  underscored: true,
});

User.hasOne(Workspace, { foreignKey: 'user_id', as: 'workspace' });
Workspace.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

export default Workspace;

