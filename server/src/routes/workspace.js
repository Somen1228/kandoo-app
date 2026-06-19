import { QueryTypes } from 'sequelize';
import { Router } from 'express';
import sequelize from '../config/database.js';
import authenticate from '../middleware/auth.js';
import Workspace from '../models/Workspace.js';
import { validateWorkspaceBoards } from '../utils/validateWorkspace.js';

const router = Router();
router.use(authenticate);

async function readLegacyBoards(userId) {
  try {
    const rows = await sequelize.query(
      `SELECT id, title, cards, position
       FROM boards
       WHERE user_id = :userId
       ORDER BY position ASC, created_at ASC`,
      { replacements: { userId }, type: QueryTypes.SELECT },
    );
    return rows.map(({ id, title, cards }) => ({ id, title, cards }));
  } catch (error) {
    if (error.original?.code === '42P01') return [];
    throw error;
  }
}

async function getOrCreateWorkspace(userId) {
  let workspace = await Workspace.findOne({ where: { user_id: userId } });
  if (workspace) return workspace;

  const legacyBoards = await readLegacyBoards(userId);
  workspace = await Workspace.create({
    user_id: userId,
    boards: legacyBoards,
    revision: legacyBoards.length ? 1 : 0,
  });
  return workspace;
}

router.get('/', async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace(req.user.id);
    return res.json({
      workspace: {
        boards: workspace.boards,
        revision: workspace.revision,
        updatedAt: workspace.updatedAt,
      },
    });
  } catch (error) {
    console.error('Load workspace failed:', error);
    return res.status(500).json({ error: 'Failed to load workspace' });
  }
});

router.put('/', async (req, res) => {
  const { boards, baseRevision, force = false } = req.body || {};
  const validationError = validateWorkspaceBoards(boards);
  if (validationError) return res.status(400).json({ error: validationError });
  if (!Number.isInteger(baseRevision) || baseRevision < 0) {
    return res.status(400).json({ error: 'baseRevision must be a non-negative integer' });
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      let workspace = await Workspace.findOne({
        where: { user_id: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!workspace) {
        workspace = await Workspace.create({ user_id: req.user.id, boards: [], revision: 0 }, { transaction });
      }

      if (!force && workspace.revision !== baseRevision) {
        return { conflict: true, workspace };
      }

      workspace.boards = boards;
      workspace.revision += 1;
      workspace.client_updated_at = new Date();
      workspace.changed('boards', true);
      await workspace.save({ transaction });
      return { conflict: false, workspace };
    });

    const payload = {
      boards: result.workspace.boards,
      revision: result.workspace.revision,
      updatedAt: result.workspace.updatedAt,
    };
    if (result.conflict) {
      return res.status(409).json({ error: 'Workspace changed on another device', workspace: payload });
    }
    return res.json({ workspace: payload });
  } catch (error) {
    console.error('Save workspace failed:', error);
    return res.status(500).json({ error: 'Failed to save workspace' });
  }
});

export default router;
