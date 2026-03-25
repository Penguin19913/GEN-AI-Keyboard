import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const keyRows = [
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
  ['Tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
  ['Caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'Enter'],
  ['Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'Shift'],
  ['Space'],
]

function normalizeKey(key) {
  if (!key) return ''
  if (key === ' ') return 'Space'
  if (key === 'Escape') return 'Esc'
  if (key === 'Meta') return 'Meta'
  return key.length === 1 ? key.toLowerCase() : key
}

function tokenAtCursor(text, cursor) {
  const slice = text.slice(0, cursor)
  const separators = [' ', '\n', '\t']
  let start = -1

  separators.forEach((sep) => {
    const idx = slice.lastIndexOf(sep)
    if (idx > start) start = idx
  })

  start += 1
  return {
    token: slice.slice(start, cursor),
    start,
    end: cursor,
  }
}

const API_BASE = 'http://localhost:5000/api/autocomplete'

async function fetchSuggestions(token, fullText) {
  if (!token) return []

  try {
    const response = await fetch(`${API_BASE}/suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ partial: token, fullText: fullText }),
    })
    const data = await response.json()
    console.log('API Response:', data) // Add this to check the response
    // Flatten all suggestions into individual words
    const allWords = (data.suggestions || []).flatMap(sugg => sugg.split(/\s+/).filter(word => word.length > 0))
    return allWords.slice(0, 9) // Limit to 9 words total
  } catch (error) {
    console.error('Error fetching suggestions:', error)
    return []
  }
}

async function transcribeAudio(audioBlob) {
  try {
    const formData = new FormData()
    formData.append('audio', audioBlob, 'audio.wav')

    const response = await fetch(`${API_BASE}/transcribe`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Transcription failed')
    }

    const data = await response.json()
    console.log('Transcribed text:', data.text)
    return data.text
  } catch (error) {
    console.error('Error transcribing audio:', error)
    return ''
  }
}

function App() {
  const [text, setText] = useState('')
  const [activeKey, setActiveKey] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const textareaRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  const setCursor = (pos) => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(pos, pos)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.onstart = () => {
        setIsRecording(true)
      }

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        setIsRecording(false)
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        
        setIsTranscribing(true)
        const transcribedText = await transcribeAudio(audioBlob)
        setIsTranscribing(false)

        if (transcribedText) {
          setText(transcribedText)
          // Optionally update suggestions for the transcribed text
          const cursorPos = transcribedText.length
          updateSuggestion(transcribedText, cursorPos)
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
    } catch (error) {
      console.error('Error accessing microphone:', error)
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  const updateSuggestion = async (newText, cursorPos) => {
    const { token } = tokenAtCursor(newText, cursorPos)
    console.log('Current token:', token, 'fullText:', newText)

    if (!token) {
      setSuggestions([])
      return
    }
    
    const fetchedSuggestions = await fetchSuggestions(token, newText)
    setSuggestions(fetchedSuggestions)
  }

  const applySuggestion = (selectedSuggestion) => {
    if (!selectedSuggestion) return
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const { token, start, end } = tokenAtCursor(text, cursorPos)

    // If token exists, enforce completion behavior; if empty, insert word at cursor.
    // if (token && !selectedSuggestion.startsWith(token)) return

    const insertedText = selectedSuggestion + ' '
    const newText = text.slice(0, start) + insertedText + text.slice(end)
    setText(newText)

    setTimeout(() => {
      setCursor(start + insertedText.length)
      setSuggestions([])
    }, 0)
  }

  const applyInsertion = (key) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const { selectionStart, selectionEnd } = textarea
    const left = text.slice(0, selectionStart)
    const right = text.slice(selectionEnd)

    if (key === 'Backspace') {
      if (selectionStart === selectionEnd && selectionStart > 0) {
        const newText = text.slice(0, selectionStart - 1) + right
        setText(newText)
        setTimeout(() => setCursor(selectionStart - 1), 0)
      } else {
        const newText = left + right
        setText(newText)
        setTimeout(() => setCursor(selectionStart), 0)
      }
      return
    }

    if (key === 'Tab') {
      const newText = left + '\t' + right
      setText(newText)
      setTimeout(() => setCursor(selectionStart + 1), 0)
      return
    }

    if (key === 'Enter') {
      const newText = left + '\n' + right
      setText(newText)
      setTimeout(() => setCursor(selectionStart + 1), 0)
      return
    }

    if (key === 'Space') {
      const newText = left + ' ' + right
      setText(newText)
      setTimeout(() => setCursor(selectionStart + 1), 0)
      return
    }

    if (key === 'Shift' || key === 'Caps') {
      return
    }

    const char = key.length === 1 ? key : ''
    if (!char) return

    const newText = left + char + right
    setText(newText)
    setTimeout(() => setCursor(selectionStart + 1), 0)
  }

  const handleVirtualClick = (key) => {
    const normalized = normalizeKey(key)
    setActiveKey(normalized)
    applyInsertion(key)
    setTimeout(() => setActiveKey(''), 170)
  }

  const handleKeyDown = (event) => {
    const key = event.key
    const normalized = normalizeKey(key)
    setActiveKey(normalized)

    if (key === 'Tab') {
      event.preventDefault()
    }

    if (key === 'Backspace' || key === 'Enter' || key === 'Tab' || key === ' ') {
      event.preventDefault()
      const virtualKey = key === ' ' ? 'Space' : key
      applyInsertion(virtualKey)
      return
    }

    if (key.length === 1) {
      // Let native handler update text first, then sync state
      event.preventDefault()
      applyInsertion(key)
    }
  }

  useEffect(() => {
    const handleKeyUp = () => setActiveKey('')
    window.addEventListener('keyup', handleKeyUp)
    return () => window.removeEventListener('keyup', handleKeyUp)
  }, [])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      setSuggestions([])
      return
    }
    const cursorPos = textarea.selectionStart ?? text.length
    updateSuggestion(text, cursorPos)
  }, [text])

  return (
    <div className="keyboard-container">
      <h1>Virtual Keyboard + Real Keyboard</h1>
      <textarea
        ref={textareaRef}
        className="type-area"
        value={text}
        onChange={(e) => {
          const newText = e.target.value
          const cursorPos = e.target.selectionStart
          setText(newText)
          updateSuggestion(newText, cursorPos)
        }}
        onKeyDown={handleKeyDown}
        placeholder="Type here or click virtual keys"
      />

      <div className="controls-area">
        <button
          className={`mic-btn ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing}
          type="button"
        >
          {isRecording ? '🎙️ Stop Recording' : '🎙️ Start Voice Input'}
        </button>
        {isTranscribing && <span className="transcribing-text">Transcribing...</span>}
      </div>

      <div className="autocomplete-area">
        {suggestions.length > 0 && (
          <div className="suggestions-list">
            {suggestions.map((word, index) => (
              <button
                key={index}
                type="button"
                className="suggestion-btn"
                onClick={() => applySuggestion(word)}
              >
                {word}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="keyboard-area">
        {keyRows.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="key-row">
            {row.map((key) => {
              const normalized = normalizeKey(key)
              const isActive = activeKey === normalized

              return (
                <button
                  key={`${rowIndex}-${key}`}
                  className={`key ${isActive ? 'key-active' : ''} ${key === 'Space' ? 'key-space' : ''} ${['Shift', 'Backspace', 'Enter', 'Tab', 'Caps'].includes(key) ? 'key-wider' : ''}`}
                  onClick={() => handleVirtualClick(key)}
                  type="button"
                >
                  {key === 'Space' ? '␣ Space' : key}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
