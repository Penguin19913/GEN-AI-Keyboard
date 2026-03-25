import express from 'express'
import multer from 'multer'
import { getAutocompleteSuggestions, transcribeAudio } from '../controllers/autocompleteController.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/suggestions', getAutocompleteSuggestions)
router.post('/transcribe', upload.single('audio'), transcribeAudio)

export default router