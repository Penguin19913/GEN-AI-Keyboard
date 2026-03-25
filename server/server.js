import express from 'express'
import 'dotenv/config' 
import autocompleteRouter from './routes/autocompleteRoute.js'

//Initialize Express
const app = express()

// Middlewares
app.use(cors())

//Connect to database


// Routes
app.get('/', (req, res)=> res.send("API Working"))
app.use('/api/autocomplete', express.json(), autocompleteRouter)

export default app

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 5000
  app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`)
  })
}
