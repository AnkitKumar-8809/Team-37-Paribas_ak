import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { uploadFile, getFiles, getFileById } from '../controllers/fileController';

const router = Router();

const upload = multer({
  dest: path.join(__dirname, '../../uploads'),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

router.post('/upload', upload.single('file'), uploadFile);
router.get('/', getFiles);
router.get('/:id', getFileById);

export default router;
