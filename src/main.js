const chatMessagesEl = document.getElementById('chatMessages')
const chatTypingEl = document.getElementById('chatTyping')
const chatFormEl = document.getElementById('chatForm')
const chatInputEl = document.getElementById('chatInput')
const chatSendBtn = document.getElementById('chatSend')
const chatModelNameEl = document.getElementById('chatModelName')

const imagePromptEl = document.getElementById('imagePrompt')
const imageGenerateBtn = document.getElementById('imageGenerate')
const imageStatusEl = document.getElementById('imageStatus')
const imageOutputEl = document.getElementById('imageOutput')
const imageModelNameEl = document.getElementById('imageModelName')

const newChatBtn = document.getElementById('newChatBtn')
const chatHistoryListEl = document.getElementById('chatHistoryList')
const sidebarToggleBtn = document.getElementById('sidebarToggle')
const sidebarEl = document.getElementById('sidebar')
// IMPORTANT:
// - These keys will live in the frontend bundle. Use course-provided keys or
//   restrict keys (if your provider allows) to limit abuse.
// - Configure them using .env with Vite.
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY
const HF_TOKEN = import.meta.env.VITE_HF_TOKEN

const OPENROUTER_MODEL =
  import.meta.env.VITE_OPENROUTER_MODEL || 'meta-llama/llama-3.1-70b-instruct'
const HF_IMAGE_MODEL =
  import.meta.env.VITE_HF_IMAGE_MODEL ||
  'stabilityai/stable-diffusion-xl-base-1.0'

const systemPrompt =
  import.meta.env.VITE_CHAT_SYSTEM_PROMPT ||
  'You are a helpful assistant. Respond clearly and concisely.'

chatModelNameEl.textContent = OPENROUTER_MODEL
imageModelNameEl.textContent = HF_IMAGE_MODEL

function ensureConfigured() {
  const missing = []
  if (!OPENROUTER_API_KEY) missing.push('VITE_OPENROUTER_API_KEY')
  if (!HF_TOKEN) missing.push('VITE_HF_TOKEN')
  if (missing.length) {
    throw new Error(
      `Missing environment variables: ${missing.join(', ')}`
    )
  }
}

function ensureOpenRouterConfigured() {
  const missing = []
  if (!OPENROUTER_API_KEY) missing.push('VITE_OPENROUTER_API_KEY')
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`)
  }
}

function ensureHFConfigured() {
  const missing = []
  if (!HF_TOKEN) missing.push('VITE_HF_TOKEN')
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`)
  }
}

function setTyping(isTyping) {
  chatTypingEl.classList.toggle('hidden', !isTyping)
}

function addBubble(role, text, { isError = false } = {}) {
  const row = document.createElement('div')
  row.className = `bubbleRow ${role}`

  const bubble = document.createElement('div')
  bubble.className = `bubble ${role}${isError ? ' error' : ''}`
  bubble.textContent = text

  row.appendChild(bubble)
  chatMessagesEl.appendChild(row)
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight
}

function escapeForPrompt(str) {
  return (str || '').toString().replace(/\s+/g, ' ').trim()
}

let sessions = []
let currentSessionId = null
let chatAbort = null

function loadSessions() {
  const stored = localStorage.getItem('foai_chat_sessions')
  if (stored) {
    try {
      sessions = JSON.parse(stored)
    } catch(e) {
      sessions = []
    }
  }
  if (sessions.length === 0) {
    createNewSession(false)
  } else {
    // switch to the most recently updated session
    sessions.sort((a, b) => b.updatedAt - a.updatedAt)
    switchSession(sessions[0].id)
  }
}

function saveSessions() {
  localStorage.setItem('foai_chat_sessions', JSON.stringify(sessions))
  renderSidebar()
}

function createNewSession(switchActive = true) {
  const newSession = {
    id: Date.now().toString(),
    title: 'New Chat',
    messages: [],
    updatedAt: Date.now()
  }
  sessions.unshift(newSession)
  if (switchActive) {
    switchSession(newSession.id)
  } else {
    saveSessions()
  }
}

function switchSession(id) {
  currentSessionId = id
  const session = sessions.find(s => s.id === id)
  if (!session) return
  
  chatMessagesEl.innerHTML = ''
  session.messages.forEach(msg => {
    addBubble(msg.role === 'user' ? 'user' : 'bot', msg.content)
  })
  
  renderSidebar()
  if (sidebarEl) sidebarEl.classList.remove('open')
}

function renderSidebar() {
  if (!chatHistoryListEl) return
  chatHistoryListEl.innerHTML = ''
  // Sort sessions by updated time descending
  sessions.sort((a, b) => b.updatedAt - a.updatedAt)
  
  sessions.forEach(session => {
    const li = document.createElement('li')
    li.className = `history-item ${session.id === currentSessionId ? 'active' : ''}`
    li.textContent = session.title || 'New Chat'
    li.addEventListener('click', () => switchSession(session.id))
    chatHistoryListEl.appendChild(li)
  })
}

async function queryOpenRouter(userText) {
  ensureOpenRouterConfigured()
  const controller = new AbortController()
  chatAbort = controller

  // Maintain conversation by replaying history.
  const currentSession = sessions.find(s => s.id === currentSessionId)
  const sessionMessages = currentSession ? currentSession.messages : []
  const messages = [{ role: 'system', content: systemPrompt }, ...sessionMessages]

  const body = {
    model: OPENROUTER_MODEL,
    messages,
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify(body),
    signal: controller.signal,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `OpenRouter error (${response.status}): ${text || 'No details'}`
    )
  }

  const result = await response.json()
  const reply = result?.choices?.[0]?.message?.content
  if (!reply) {
    throw new Error('Unexpected OpenRouter response: missing reply text')
  }

  return reply
}

async function generateImageFromHF(promptText) {
  ensureHFConfigured()

  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${HF_IMAGE_MODEL}`,
    {
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({ inputs: promptText }),
    }
  )

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`HF image error (${response.status}): ${text || 'No details'}`)
  }

  return await response.blob()
}

function handleChatSend(e) {
  e?.preventDefault?.()

  const userText = escapeForPrompt(chatInputEl.value)
  if (!userText) return

  chatInputEl.value = ''
  addBubble('user', userText)
  
  const currentSession = sessions.find(s => s.id === currentSessionId)
  if (currentSession) {
    currentSession.messages.push({ role: 'user', content: userText })
    currentSession.updatedAt = Date.now()
    if (currentSession.messages.length === 1) {
      currentSession.title = userText.slice(0, 30) + (userText.length > 30 ? '...' : '')
    }
    saveSessions()
  }

  setTyping(true)
  chatSendBtn.disabled = true

  ;(async () => {
    try {
      const reply = await queryOpenRouter(userText)
      addBubble('bot', reply)
      if (currentSession) {
        currentSession.messages.push({ role: 'assistant', content: reply })
        currentSession.updatedAt = Date.now()
        saveSessions()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addBubble('bot', msg, { isError: true })
    } finally {
      setTyping(false)
      chatSendBtn.disabled = false
      chatAbort = null
    }
  })()
}

chatFormEl.addEventListener('submit', handleChatSend)
chatSendBtn.addEventListener('click', (e) => handleChatSend(e))

imageGenerateBtn.addEventListener('click', async () => {
  const promptText = escapeForPrompt(imagePromptEl.value)
  if (!promptText) return

  imagePromptEl.value = ''
  imageStatusEl.classList.remove('hidden')
  imageStatusEl.textContent = 'Generating…'

  imageGenerateBtn.disabled = true

  try {
    // Optional: clear previous image immediately
    imageOutputEl.removeAttribute('src')

    const blob = await generateImageFromHF(promptText)
    const url = URL.createObjectURL(blob)
    imageOutputEl.src = url

    imageStatusEl.textContent = 'Done.'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    imageStatusEl.textContent = `Error: ${msg}`
    imageStatusEl.style.color = '#ff6b6b'
  } finally {
    imageGenerateBtn.disabled = false
  }
})

// Default state
setTyping(false)
chatModelNameEl.textContent = OPENROUTER_MODEL
imageModelNameEl.textContent = HF_IMAGE_MODEL
imageStatusEl.classList.add('hidden')

if (newChatBtn) {
  newChatBtn.addEventListener('click', () => createNewSession())
}
if (sidebarToggleBtn) {
  sidebarToggleBtn.addEventListener('click', () => {
    sidebarEl.classList.toggle('open')
  })
}

// Initialize sessions
loadSessions()

