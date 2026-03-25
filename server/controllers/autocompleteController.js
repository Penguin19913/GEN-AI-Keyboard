import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const getAutocompleteSuggestions = async (req, res) => {
  try {
    const { partial, fullText } = req.body

    const prompt = `You are an AI autocomplete assistant.

Given:
- Full text context: "${fullText}"
- Partial word: "${partial}"
- Partial length: ${partial.length}

Task:
Suggest up to 3 next-word completions.

MODE SELECTION (STRICT):

- If partial length == 0 OR partial is "":
  → Use ONLY context to predict next words
  → Do NOT apply prefix matching

- If partial length >= 1:
  → ALL suggestions MUST start with "${partial}" (case-insensitive)

RANKING PRIORITY (VERY IMPORTANT):

When multiple valid completions exist:
1. Prefer the most common and natural base word (e.g., "name" over "naming")
2. Prefer shorter complete words over longer derived forms
3. Then consider context relevance to rank suggestions
4. Avoid uncommon or awkward words unless strongly supported by context

CONTEXT RULE:
- If fullText contains multiple words (a sentence), prioritize words that best complete the sentence meaning
- If context is weak, fall back to most common word completions

STRICT RULES:
- Only extend the partial word, do not replace it
- Each suggestion must be a single complete word
- No duplicates
- No quotes, numbers, or special characters
- Only alphabetic words (a–z)

OUTPUT FORMAT (STRICT):
- Return ONLY a comma-separated list of words
- No extra text
- If no valid suggestions exist, return an empty string`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.3,
    })

    function enforceAndClean(words, partial) {
      const p = partial.toLowerCase().trim()

      return words
        .map(w => w.trim().toLowerCase())
        .filter(w => {
          // Allow semantic mode if no partial
          if (p.length === 0) return /^[a-z]+$/.test(w)

          return (
            w.startsWith(p) &&        // prefix enforcement
            /^[a-z]+$/.test(w)        // only alphabets
          )
        })
    }

    function rankSuggestions(words) {
      return words.sort((a, b) => {
        // 1. shorter words first
        if (a.length !== b.length) return a.length - b.length
        
        // 2. fallback alphabetical
        return a.localeCompare(b)
      })
    }

    const rawWords = response.choices[0].message.content.trim().split(',')
    const cleanedWords = enforceAndClean(rawWords, partial)
    const finalSuggestions = rankSuggestions(cleanedWords)
    const suggestionsText = response.choices[0].message.content.trim()
    console.log('OpenAI Response:', suggestionsText) // Add logging
    const suggestions = finalSuggestions
    console.log('Parsed Suggestions:', suggestions)

    res.json({ suggestions, openaiResponse: suggestionsText })
  } catch (error) {
    console.error('Error in autocomplete:', error)
    res.status(500).json({ error: 'Failed to get suggestions' })
  }
}

export const transcribeAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' })
    }

    // Use OpenAI Whisper API to transcribe the audio
    const transcript = await openai.audio.transcriptions.create({
      file: new File([req.file.buffer], req.file.originalname),
      model: 'whisper-1',
    })

    const text = transcript.text.trim()
    console.log('Transcribed text:', text)

    res.json({ text })
  } catch (error) {
    console.error('Error in transcription:', error)
    res.status(500).json({ error: 'Failed to transcribe audio' })
  }
}